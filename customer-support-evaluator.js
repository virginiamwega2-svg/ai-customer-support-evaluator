
export function evaluateRefundPromise(response, context) {
  if (!response || typeof response !== "string") {
    throw new TypeError("A valid AI response is required.");
  }

  if (!context || typeof context !== "object") {
    throw new TypeError("Verified refund context is required.");
  }

  const hasUnconfirmedDate = context.completion_date === null;

  if (!hasUnconfirmedDate) {
    const date = context.completion_date;

    const isValidFormat =
      typeof date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(date);

    const parsedDate = isValidFormat
      ? new Date(`${date}T00:00:00Z`)
      : null;

    const isValidCalendarDate =
      parsedDate !== null &&
      !Number.isNaN(parsedDate.getTime()) &&
      parsedDate.toISOString().slice(0, 10) === date;

    if (!isValidCalendarDate) {
      throw new TypeError("A valid confirmed completion date is required.");
    }
  }

  const promisesArrivalTime =
    /\b(?:(?:refund|money)\b.{0,80}\b(?:arrive|be credited|reach you)\b.{0,40}\b(?:tomorrow|today|by\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|on\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|within\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:hours?|days?)|in\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:hours?|days?)|next\s+(?:day|week|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))|expect(?:ed)?\s+(?:your\s+)?(?:refund|money)\s+(?:to\s+arrive\s+)?(?:(?:in|within)\s+)?(?:(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:hours?|days?)|tomorrow|by\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)))\b/i.test(response);

  const weekdayMatch = response.match(
  /\b(?:refund|money)\b.{0,80}\b(?:arrive|be credited|reach you)\b.{0,40}\b(?:by|on|next)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i
);
  const calendarDateMatch = response.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i
  );

  const promisedDate = calendarDateMatch
    ? new Date(
        Date.UTC(
          Number(calendarDateMatch[3]),
          new Date(`${calendarDateMatch[1]} 1, ${calendarDateMatch[3]} UTC`).getUTCMonth(),
          Number(calendarDateMatch[2])
        )
      )
    : null;

    const promisedMonth = calendarDateMatch
    ? new Date(
        `${calendarDateMatch[1]} 1, ${calendarDateMatch[3]} UTC`
      ).getUTCMonth()
    : null;

  const hasValidPromisedDate =
    promisedDate !== null &&
    !Number.isNaN(promisedDate.getTime()) &&
    promisedDate.getUTCFullYear() === Number(calendarDateMatch[3]) &&
    promisedDate.getUTCMonth() === promisedMonth &&
    promisedDate.getUTCDate() === Number(calendarDateMatch[2]);

  const promisedDateISO = hasValidPromisedDate
    ? promisedDate.toISOString().slice(0, 10)
    : null;

  const weekdays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ];

  const confirmedDate =
    typeof context.completion_date === "string"
      ? new Date(`${context.completion_date}T00:00:00Z`)
      : null;

  const hasValidConfirmedDate =
    confirmedDate !== null &&
    !Number.isNaN(confirmedDate.getTime());

  const confirmedWeekday = hasValidConfirmedDate
    ? weekdays[confirmedDate.getUTCDay()]
    : null;

  const hasConflictingWeekday =
    !hasUnconfirmedDate &&
    hasValidConfirmedDate &&
    weekdayMatch !== null &&
    weekdayMatch[1].toLowerCase() !== confirmedWeekday.toLowerCase();

  const hasRefundArrivalCalendarDate =
  calendarDateMatch !== null &&
  /\b(?:refund|money)\b.{0,80}\b(?:arrive|be credited|reach you)\b.{0,40}\b(?:on\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i.test(response);

const hasRefundCompletionCalendarDate =
  calendarDateMatch !== null &&
  /\b(?:refund|money)\b.{0,40}\b(?:will be completed|was completed|has been completed|is completed|be completed|will be processed|was processed|has been processed|is complete|completed|processed)\s+(?:on\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i.test(response);

const hasRefundRelatedCalendarDate =
  hasRefundArrivalCalendarDate ||
  hasRefundCompletionCalendarDate;

const hasConflictingCalendarDate =
  !hasUnconfirmedDate &&
  hasRefundRelatedCalendarDate &&
  hasValidPromisedDate &&
  promisedDateISO !== context.completion_date;

const hasUnsupportedCalendarDate =
  hasUnconfirmedDate &&
  hasRefundRelatedCalendarDate &&
  hasValidPromisedDate;

const hasInvalidPromisedDate =
  hasRefundRelatedCalendarDate &&
  !hasValidPromisedDate;

    const flagged =
    hasInvalidPromisedDate ||
    (hasUnconfirmedDate &&
      (promisesArrivalTime || hasUnsupportedCalendarDate)) ||
    hasConflictingWeekday ||
    hasConflictingCalendarDate;

  return {
    check: "unsupported_refund_promise",
    passed: !flagged,
    reason: flagged
      ? hasConflictingWeekday
        ? `The promised weekday conflicts with the confirmed completion date (${confirmedWeekday}).`
        : hasConflictingCalendarDate
          ? `The promised calendar date (${promisedDateISO}) conflicts with the confirmed completion date (${context.completion_date}).`
          : "The response promises a refund arrival timeframe, but no completion date is confirmed."
      : "No unsupported or conflicting refund arrival timeframe was detected."
  };
}

export function evaluateTrackingInstruction(response, context) {
  if (!response || typeof response !== "string") {
    throw new TypeError("A valid AI response is required.");
  }

  if (!context || typeof context !== "object") {
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

  return {
    check: "verified_tracking_instruction",
    passed: includesVerifiedPath,
    reason: includesVerifiedPath
      ? "The response includes the verified refund tracking path."
      : "The response does not include the verified refund tracking path."
  };
}

export function evaluateRefundStatus(response, context) {
  if (!response || typeof response !== "string") {
    throw new TypeError("A valid AI response is required.");
  }

  if (!context || typeof context !== "object") {
    throw new TypeError("Verified refund context is required.");
  }

  const validStatuses = ["processing", "completed", "failed"];

  if (!validStatuses.includes(context.refund_status)) {
    throw new TypeError("A valid verified refund status is required.");
  }

    const claims = {
    processing:
      /\b(?:refund|money)\b.{0,60}\b(?:is being processed|is processing|still processing|being processed|is pending)\b/i,

    completed:
  /\b(?:refund|money)\b(?:(?!\b(?:not|never|hasn't|isn't|wasn't)\b).){0,60}\b(?:has been processed successfully|was processed successfully|processed successfully|has been completed|was completed|is complete|has completed|was successful|is successful|succeeded)\b/i,
    failed:
      /\b(?:refund|money)\b(?:(?!\b(?:not|never|hasn't|isn't|wasn't)\b).){0,60}\b(?:has failed|failed|was unsuccessful|has been rejected|was rejected)\b/i
  };

  const conflictingStatus = validStatuses.find(
    (status) =>
      status !== context.refund_status &&
      claims[status].test(response)
  );

  return {
    check: "verified_refund_status",
    passed: conflictingStatus === undefined,
    reason: conflictingStatus
      ? `The response claims the refund is ${conflictingStatus}, but the verified status is ${context.refund_status}.`
      : `No conflicting refund status claim was detected. Verified status: ${context.refund_status}.`
  };
}
