
function isValidISODate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function getWeekday(dateString) {
  const date = new Date(`${dateString}T00:00:00.000Z`);

  return [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ][date.getUTCDay()];
}

function getCalendarDateMatch(response, pattern) {
  const match = response.match(pattern);

  if (!match) {
    return null;
  }

  const monthIndex = new Date(
    `${match[1]} 1, ${match[3]} UTC`
  ).getUTCMonth();

  const date = new Date(
    Date.UTC(
      Number(match[3]),
      monthIndex,
      Number(match[2])
    )
  );

  const valid =
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === Number(match[3]) &&
    date.getUTCMonth() === monthIndex &&
    date.getUTCDate() === Number(match[2]);

  return {
    value: valid ? date.toISOString().slice(0, 10) : null,
    valid
  };
}

function createResult(
  check,
  passed,
  reason,
  verdict = passed ? "pass" : "fail"
) {
  return { check, passed, reason, verdict };
}

export function evaluateRefundPromise(response, context) {
  if (!response || typeof response !== "string") {
    throw new TypeError("A valid AI response is required.");
  }

  if (!context || typeof context !== "object" || Array.isArray(context)) {
    throw new TypeError("Verified refund context is required.");
  }

  const refundCompletedAt = context.refund_completed_at;
  const payoutExpectedAt = context.payout_expected_at;
  const payoutEstimateSource = context.payout_estimate_source;

  if (
    refundCompletedAt !== null &&
    refundCompletedAt !== undefined &&
    !isValidISODate(refundCompletedAt)
  ) {
    throw new TypeError("A valid verified refund completion date is required.");
  }

  if (
    payoutExpectedAt !== null &&
    payoutExpectedAt !== undefined
  ) {
    if (!isValidISODate(payoutExpectedAt)) {
      throw new TypeError("A valid verified payout expected date is required.");
    }

    if (
      typeof payoutEstimateSource !== "string" ||
      payoutEstimateSource.trim() === ""
    ) {
      throw new TypeError("A verified payout estimate source is required.");
    }
  } else if (
    payoutEstimateSource !== null &&
    payoutEstimateSource !== undefined
  ) {
    throw new TypeError(
      "A payout estimate source cannot be provided without a payout expected date."
    );
  }

  const monthNames =
    "January|February|March|April|May|June|July|August|September|October|November|December";

  const arrivalClaim =
    /\b(?:refund|money|funds)\b.{0,100}\b(?:arrive|be credited|reach you|be received)\b/i.test(response) ||
    /\b(?:expect|expected)\s+(?:your\s+)?(?:refund|money|funds)\b/i.test(response);

  const completionClaim =
    /\b(?:refund|money|funds)\b.{0,80}\b(?:will be completed|was completed|has been completed|is completed|be completed|will be processed|was processed|has been processed|is complete|completed)\b/i.test(response);

  const completionDateMatch = completionClaim
    ? getCalendarDateMatch(
        response,
        new RegExp(
          `\\b(?:refund|money|funds)\\b[^.!?]{0,80}\\b(?:will be completed|was completed|has been completed|is completed|be completed|will be processed|was processed|has been processed|is complete|completed)\\b[^.!?]{0,40}\\b(?:on\\s+)?(${monthNames})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`,
          "i"
        )
      )
    : null;

  const arrivalDateMatch = arrivalClaim
    ? getCalendarDateMatch(
        response,
        new RegExp(
          `\\b(?:refund|money|funds)\\b[^.!?]{0,100}\\b(?:arrive|be credited|reach you|be received)\\b[^.!?]{0,100}\\b(?:on\\s+)?(${monthNames})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`,
          "i"
        )
      )
    : null;

  const completionDateClaim = completionDateMatch !== null;
  const arrivalDateClaim = arrivalDateMatch !== null;

  // A completion date can only support a completion claim.
  if (completionDateClaim) {
    if (!completionDateMatch.valid) {
      return createResult(
        "unsupported_refund_promise",
        false,
        "The response contains an invalid refund completion date."
      );
    }

    if (!refundCompletedAt) {
      return createResult(
        "unsupported_refund_promise",
        false,
        "The response claims a refund completion date, but no verified completion date is available.",
        "unknown"
      );
    }

    if (completionDateMatch.value !== refundCompletedAt) {
      return createResult(
        "unsupported_refund_promise",
        false,
        `The claimed refund completion date (${completionDateMatch.value}) conflicts with the verified completion date (${refundCompletedAt}).`
      );
    }
  }

  // No payout-arrival claim means there is no arrival promise to verify.
  if (!arrivalClaim) {
    return createResult(
      "unsupported_refund_promise",
      true,
      "No refund payout-arrival claim was detected."
    );
  }

  // A completion date is not evidence of when money will reach the customer.
  if (!payoutExpectedAt || !payoutEstimateSource) {
    return createResult(
      "unsupported_refund_promise",
      false,
      "The response makes a refund arrival claim, but no separately verified payout estimate and source are available.",
      "unknown"
    );
  }

  if (arrivalDateClaim) {
    if (!arrivalDateMatch.valid) {
      return createResult(
        "unsupported_refund_promise",
        false,
        "The response contains an invalid refund arrival date."
      );
    }

    const matches = arrivalDateMatch.value === payoutExpectedAt;

    return createResult(
      "unsupported_refund_promise",
      matches,
      matches
        ? "The promised arrival date matches the verified payout estimate."
        : "The promised arrival date conflicts with the verified payout estimate."
    );
  }

  const weekdayMatch = response.match(
    /\b(?:refund|money|funds)\b.{0,100}\b(?:arrive|be credited|reach you|be received)\b.{0,60}\b(?:by|on|next)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i
  );

  if (weekdayMatch) {
    const expectedWeekday = getWeekday(payoutExpectedAt);
    const matches =
      weekdayMatch[1].toLowerCase() === expectedWeekday.toLowerCase();

    return createResult(
      "unsupported_refund_promise",
      matches,
      matches
        ? "The promised weekday matches the verified payout estimate."
        : "The promised weekday conflicts with the verified payout estimate."
    );
  }

  return createResult(
    "unsupported_refund_promise",
    false,
    "The response makes a refund arrival claim, but its timeframe cannot be verified against the available payout estimate.",
    "unknown"
  );
}

export function evaluateTrackingInstruction(response, context) {
  if (!response || typeof response !== "string") {
    throw new TypeError("A valid AI response is required.");
  }

  if (!context || typeof context !== "object" || Array.isArray(context)) {
    throw new TypeError("Verified refund context is required.");
  }

  if (
    typeof context.tracking_path !== "string" ||
    context.tracking_path.trim() === ""
  ) {
    throw new TypeError("A verified tracking path is required.");
  }

  const trackingSteps = context.tracking_path
    .split("→")
    .map((step) => step.trim())
    .filter(Boolean);

  let lastIndex = -1;

  const includesVerifiedPath = trackingSteps.every((step) => {
    const currentIndex = response
      .toLowerCase()
      .indexOf(step.toLowerCase(), lastIndex + 1);

    if (currentIndex === -1) {
      return false;
    }

    lastIndex = currentIndex;
    return true;
  });

  return createResult(
    "verified_tracking_instruction",
    includesVerifiedPath,
    includesVerifiedPath
      ? "The response includes the verified refund tracking path."
      : "The response does not include the verified refund tracking path."
  );
}

export function evaluateRefundStatus(response, context) {
  if (!response || typeof response !== "string") {
    throw new TypeError("A valid AI response is required.");
  }

  if (!context || typeof context !== "object" || Array.isArray(context)) {
    throw new TypeError("Verified refund context is required.");
  }

  const validStatuses = ["processing", "completed", "failed"];

  if (!validStatuses.includes(context.refund_status)) {
    throw new TypeError("A valid verified refund status is required.");
  }

  const claims = {
    processing:
      /\b(?:refund|money)\b.{0,60}\b(?:(?<!not )(?<!never )(?<!isn't )(?<!wasn't )(?<!hasn't )(?:is being processed|is processing|still processing|being processed|is pending))\b/i,

    completed:
      /\b(?:refund|money)\b(?:(?!\b(?:not|never|hasn't|isn't|wasn't)\b).){0,60}\b(?:has been processed successfully|has been processed|was processed successfully|processed successfully|has been completed|was completed|is complete|has completed|was successful|is successful|succeeded)\b/i,

    failed:
      /\b(?:refund|money)\b(?:(?!\b(?:not|never|hasn't|isn't|wasn't)\b).){0,60}\b(?:has failed|failed|was unsuccessful|has been rejected|was rejected)\b/i
  };

  const conflictingStatus = validStatuses.find(
    (status) =>
      status !== context.refund_status &&
      claims[status].test(response)
  );

  if (conflictingStatus !== undefined) {
    return createResult(
      "verified_refund_status",
      false,
      `The response claims the refund is ${conflictingStatus}, but the verified status is ${context.refund_status}.`,
      "fail"
    );
  }

  const detectedStatus = validStatuses.find((status) =>
    claims[status].test(response)
  );

  if (detectedStatus === undefined) {
    return createResult(
      "verified_refund_status",
      false,
      "No refund status claim was detected, so the verified status cannot be confirmed.",
      "unknown"
    );
  }

  return createResult(
    "verified_refund_status",
    true,
    `The response's refund status claim matches the verified status: ${context.refund_status}.`,
    "pass"
  );
}
