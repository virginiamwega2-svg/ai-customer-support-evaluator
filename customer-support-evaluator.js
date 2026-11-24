
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

function parseCalendarDateMatch(match) {
  const monthIndex = new Date(
    `${match[1]} 1, ${match[3]} UTC`
  ).getUTCMonth();

  const date = new Date(
    Date.UTC(Number(match[3]), monthIndex, Number(match[2]))
  );

  const valid =
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === Number(match[3]) &&
    date.getUTCMonth() === monthIndex &&
    date.getUTCDate() === Number(match[2]);

  return {
    value: valid ? date.toISOString().slice(0, 10) : null,
    valid,
    text: match[0],
    index: match.index,
    endIndex: match.index + match[0].length
  };
}

function getCalendarDateMatch(response, pattern) {
  const match = response.match(pattern);
  return match ? parseCalendarDateMatch(match) : null;
}

function getCalendarDateMatches(response, pattern) {
  const globalPattern = new RegExp(
    pattern.source,
    `${pattern.flags.replace("g", "")}g`
  );

  return Array.from(
    response.matchAll(globalPattern),
    parseCalendarDateMatch
  );
}

function getConnectedCalendarDateMatches(response, matches, monthNames) {
  const additionalMatches = [];

  for (const match of matches) {
    const remainingText = response.slice(match.endIndex);
    const sentenceEnd = remainingText.search(/[.!?]/);
    const sentenceRemainder =
      sentenceEnd === -1
        ? remainingText
        : remainingText.slice(0, sentenceEnd);

    const alternativePattern = new RegExp(
      `\\b(?:and|or)\\s+(${monthNames})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`,
      "gi"
    );

    for (const alternative of sentenceRemainder.matchAll(alternativePattern)) {
      const parsed = parseCalendarDateMatch(alternative);
      const startIndex = match.endIndex + alternative.index;

      additionalMatches.push({
        ...parsed,
        index: startIndex,
        endIndex: startIndex + alternative[0].length
      });
    }
  }

  return [...matches, ...additionalMatches].sort(
    (a, b) => a.index - b.index
  );
}

function createResult(
  check,
  passed,
  reason,
  verdict = passed ? "pass" : "fail",
  evidence = []
) {
  const result = { check, passed, reason, verdict };

  if (evidence.length > 0) {
    result.evidence = evidence;
  }

  return result;
}

function createDateEvidence(
  claimType,
  match,
  verifiedValue,
  verifiedField,
  verifiedSource = null
) {
  const hasVerifiedValue =
    verifiedValue !== null && verifiedValue !== undefined;

  return {
    claimType,
    claimedValue: match.value,
    verifiedValue: hasVerifiedValue ? verifiedValue : null,
    verifiedField: hasVerifiedValue ? verifiedField : null,
    verifiedSource: hasVerifiedValue ? verifiedSource : null,
    responseExcerpt: match.text,
    startIndex: match.index,
    endIndex: match.endIndex
  };
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

  if (payoutExpectedAt !== null && payoutExpectedAt !== undefined) {
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
    /\b(?:refund|money|funds)\b.{0,100}\b(?:arrive|be credited|reach you|reach your bank|be received)\b/i.test(response) ||
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

  const arrivalDatePattern = new RegExp(
    `\\b(?:refund|money|funds)\\b[^.!?]{0,100}\\b(?:arrive|be credited|reach you|reach your bank|be received)\\b[^.!?]{0,100}?\\b(?:on\\s+)?(${monthNames})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`,
    "i"
  );

  const arrivalDateMatches = arrivalClaim
    ? getConnectedCalendarDateMatches(
        response,
        getCalendarDateMatches(response, arrivalDatePattern),
        monthNames
      )
    : [];

  // Allow an immediate "It" reference to inherit the refund subject
  // from the preceding sentence when verifying payout-arrival dates.
  if (arrivalClaim) {
    const sentences = Array.from(
      response.matchAll(/[^.!?]+[.!?]?/g)
    );

    for (let index = 1; index < sentences.length; index++) {
      const previousSentence = sentences[index - 1][0];
      const currentSentence = sentences[index][0];
      const trimmedSentence = currentSentence.trim();

      if (
        !/\b(?:refund|money|funds)\b/i.test(previousSentence) ||
        !/^It\b/i.test(trimmedSentence)
      ) {
        continue;
      }

      const referencedResponse = `refund ${trimmedSentence}`;
      const referencedMatches = getConnectedCalendarDateMatches(
        referencedResponse,
        getCalendarDateMatches(referencedResponse, arrivalDatePattern),
        monthNames
      );

      if (referencedMatches.length === 0) {
        continue;
      }

      const leadingWhitespace =
        currentSentence.length - currentSentence.trimStart().length;

      const sentenceStart =
        sentences[index].index + leadingWhitespace;

      for (const referencedMatch of referencedMatches) {
        arrivalDateMatches.push({
          ...referencedMatch,
          text: trimmedSentence,
          index: sentenceStart,
          endIndex: sentenceStart + trimmedSentence.length
        });
      }
    }

    arrivalDateMatches.sort((a, b) => a.index - b.index);
  }

  const completionDateClaim = completionDateMatch !== null;
  const arrivalDateClaim = arrivalDateMatches.length > 0;
  const evidence = [];

  // Collect both records before evaluating either claim.
  if (completionDateClaim) {
    evidence.push(
      createDateEvidence(
        "refund_completion_date",
        completionDateMatch,
        refundCompletedAt,
        "refund_completed_at"
      )
    );
  }

  if (arrivalDateClaim) {
    for (const match of arrivalDateMatches) {
      evidence.push(
        createDateEvidence(
          "payout_arrival_date",
          match,
          payoutExpectedAt,
          "payout_expected_at",
          payoutEstimateSource
        )
      );
    }
  }

  if (arrivalClaim) {
    const arrivalClaimPattern =
      /\b(?:refund|money|funds)\b.{0,100}\b(?:arrive|be credited|reach you|reach your bank|be received)\b|\b(?:expect|expected)\s+(?:your\s+)?(?:refund|money|funds)\b/i;

    const sentences = Array.from(
      response.matchAll(/[^.!?]+[.!?]?/g)
    );

    for (const sentence of sentences) {
      const excerpt = sentence[0].trim();

      if (!arrivalClaimPattern.test(excerpt)) {
        continue;
      }

      const sentenceStart = sentence.index;
      const sentenceEnd = sentenceStart + sentence[0].length;

      const containsCalendarArrivalDate = arrivalDateMatches.some(
        (match) =>
          match.index >= sentenceStart &&
          match.index < sentenceEnd
      );

      if (containsCalendarArrivalDate) {
        continue;
      }

      const leadingWhitespace =
        sentence[0].length - sentence[0].trimStart().length;

      const startIndex = sentence.index + leadingWhitespace;

      evidence.push({
        claimType: "payout_arrival_claim",
        claimedValue: excerpt,
        verifiedValue: payoutExpectedAt,
        verifiedField: payoutExpectedAt ? "payout_expected_at" : null,
        verifiedSource: payoutEstimateSource,
        responseExcerpt: excerpt,
        startIndex,
        endIndex: startIndex + excerpt.length
      });
    }
  }

  // A completion date can only be supported by the verified completion date.
  if (completionDateClaim) {
    if (!completionDateMatch.valid) {
      return createResult(
        "unsupported_refund_promise",
        false,
        "The response contains an invalid refund completion date.",
        undefined,
        evidence
      );
    }

    if (!refundCompletedAt) {
      return createResult(
        "unsupported_refund_promise",
        false,
        "The response claims a refund completion date, but no verified completion date is available.",
        "unknown",
        evidence
      );
    }

    if (completionDateMatch.value !== refundCompletedAt) {
      return createResult(
        "unsupported_refund_promise",
        false,
        `The claimed refund completion date (${completionDateMatch.value}) conflicts with the verified completion date (${refundCompletedAt}).`,
        undefined,
        evidence
      );
    }
  }

  if (!arrivalClaim) {
    return createResult(
      "unsupported_refund_promise",
      true,
      "No refund payout-arrival claim was detected.",
      undefined,
      evidence
    );
  }

  // Completion dates cannot substantiate payout-arrival claims.
  if (!payoutExpectedAt || !payoutEstimateSource) {
    return createResult(
      "unsupported_refund_promise",
      false,
      "The response makes a refund arrival claim, but no separately verified payout estimate and source are available.",
      "unknown",
      evidence
    );
  }

  if (arrivalDateClaim) {
    const hasInvalidDate = arrivalDateMatches.some(
      (match) => !match.valid
    );

    if (hasInvalidDate) {
      return createResult(
        "unsupported_refund_promise",
        false,
        "The response contains an invalid refund arrival date.",
        undefined,
        evidence
      );
    }

    const hasConflictingDate = arrivalDateMatches.some(
      (match) => match.value !== payoutExpectedAt
    );

    const weekdayPattern =
      /\b(?:refund|money|funds)\b.{0,100}\b(?:arrive|be credited|reach you|reach your bank|be received)\b.{0,60}\b(?:by|on|next)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i;

    const weekdayClaims = evidence.filter(
      (item) =>
        item.claimType === "payout_arrival_claim" &&
        weekdayPattern.test(item.responseExcerpt)
    );

    const expectedWeekday = getWeekday(payoutExpectedAt);

    const hasConflictingWeekday = weekdayClaims.some((item) => {
      const match = item.responseExcerpt.match(weekdayPattern);

      return (
        match &&
        match[1].toLowerCase() !== expectedWeekday.toLowerCase()
      );
    });

    const hasUnverifiableRelativeClaim = evidence.some(
      (item) =>
        item.claimType === "payout_arrival_claim" &&
        !weekdayPattern.test(item.responseExcerpt)
    );

    if (hasConflictingDate || hasConflictingWeekday) {
      return createResult(
        "unsupported_refund_promise",
        false,
        hasConflictingDate
          ? "One or more promised arrival dates conflict with the verified payout estimate."
          : "One or more promised arrival weekdays conflict with the verified payout estimate.",
        undefined,
        evidence
      );
    }

    if (hasUnverifiableRelativeClaim) {
      return createResult(
        "unsupported_refund_promise",
        false,
        "A calendar arrival date matches, but an additional relative arrival timeframe cannot be verified.",
        "unknown",
        evidence
      );
    }

    return createResult(
      "unsupported_refund_promise",
      true,
      "The promised arrival dates and any weekday claims match the verified payout estimate.",
      undefined,
      evidence
    );
  }

  const weekdayMatch = response.match(
    /\b(?:refund|money|funds)\b.{0,100}\b(?:arrive|be credited|reach you|reach your bank|be received)\b.{0,60}\b(?:by|on|next)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i
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
        : "The promised weekday conflicts with the verified payout estimate.",
      undefined,
      evidence
    );
  }

  return createResult(
    "unsupported_refund_promise",
    false,
    "The response makes a refund arrival claim, but its timeframe cannot be verified against the available payout estimate.",
    "unknown",
    evidence
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
  const evidence = [];

  for (const step of trackingSteps) {
    const currentIndex = response
      .toLowerCase()
      .indexOf(step.toLowerCase(), lastIndex + 1);

    if (currentIndex === -1) {
      break;
    }

    evidence.push({
      claimType: "tracking_step",
      claimedValue: step,
      verifiedValue: step,
      verifiedField: "tracking_path",
      verifiedSource: null,
      responseExcerpt: response.slice(
        currentIndex,
        currentIndex + step.length
      ),
      startIndex: currentIndex,
      endIndex: currentIndex + step.length
    });

    lastIndex = currentIndex;
  }

  const includesVerifiedPath = evidence.length === trackingSteps.length;

  return createResult(
    "verified_tracking_instruction",
    includesVerifiedPath,
    includesVerifiedPath
      ? "The response includes the verified refund tracking path."
      : "The response does not include the verified refund tracking path.",
    undefined,
    evidence
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
      /\b(?:refund|money)\b(?!\s+request\b).{0,60}\b(?:(?<!not )(?<!never )(?<!isn't )(?<!wasn't )(?<!hasn't )(?:is being processed|is processing|still processing|being processed|is pending))\b/i,

    completed:
      /\b(?:refund|money)\b(?:(?!\b(?:not|never|hasn't|isn't|wasn't)\b).){0,60}\b(?:has been processed successfully|has been processed|was processed successfully|processed successfully|has been completed|was completed|is complete|has completed|was successful|is successful|succeeded)\b/i,

    failed:
      /\b(?:refund|money)\b(?:(?!\b(?:not|never|hasn't|isn't|wasn't)\b).){0,60}\b(?:has failed|failed|was unsuccessful|has been rejected|was rejected)\b/i
  };

  let previousSentenceHasRefundSubject = false;

const evidence = [...response.matchAll(/[^.!?]+[.!?]?/g)]
  .flatMap((sentenceMatch) => {
    const sentence = sentenceMatch[0];
    const leadingWhitespace = sentence.match(/^\s*/)[0].length;
    const content = sentence.slice(leadingWhitespace);
    const contentStart = sentenceMatch.index + leadingWhitespace;

    const hasRefundSubject = /\b(?:refund|money)\b/i.test(content);
    const inheritsRefundSubject =
      previousSentenceHasRefundSubject && /^it\b/i.test(content);

    previousSentenceHasRefundSubject = hasRefundSubject;

    const prefix = inheritsRefundSubject ? "refund " : "";
    const matchingText = prefix + content;

    return validStatuses.flatMap((status) => {
      const pattern = new RegExp(claims[status].source, "gi");

      return [...matchingText.matchAll(pattern)].map((match) => {
        const excerpt = match[0].slice(prefix.length);
        const startIndex = contentStart + match.index;

        return {
          claimType: "refund_status",
          claimedValue: status,
          verifiedValue: context.refund_status,
          verifiedField: "refund_status",
          verifiedSource: null,
          responseExcerpt: excerpt,
          startIndex,
          endIndex: startIndex + excerpt.length
        };
      });
    });
  })
  .sort((a, b) => a.startIndex - b.startIndex);

  const conflictingStatus = validStatuses.find(
    (status) =>
      status !== context.refund_status &&
      evidence.some((item) => item.claimedValue === status)
  );

  if (conflictingStatus !== undefined) {
    return createResult(
      "verified_refund_status",
      false,
      "The response claims the refund is " + conflictingStatus +
        ", but the verified status is " + context.refund_status + ".",
      "fail",
      evidence
    );
  }

  const detectedStatus = validStatuses.find((status) =>
    evidence.some((item) => item.claimedValue === status)
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
    "The response's refund status claim matches the verified status: " +
      context.refund_status + ".",
    "pass",
    evidence
  );
}
