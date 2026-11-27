const VALID_VERDICTS = ["pass", "fail", "unknown"];
const VALID_REFUND_STATUSES = ["processing", "completed", "failed"];

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function requireNonEmptyString(value, field, location) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${location}: ${field} must be a non-empty string.`);
  }
}

function validateContext(context, location) {
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    throw new TypeError(`${location}: context must be an object.`);
  }

  if (!VALID_REFUND_STATUSES.includes(context.refund_status)) {
    throw new TypeError(`${location}: invalid refund_status.`);
  }

  requireNonEmptyString(context.tracking_path, "tracking_path", location);

  for (const field of ["refund_completed_at", "payout_expected_at"]) {
    const value = context[field];

    if (value !== null && !isValidDate(value)) {
      throw new TypeError(
        `${location}: ${field} must be a valid YYYY-MM-DD date or null.`
      );
    }
  }

  if (
    context.payout_estimate_source !== null &&
    (
      typeof context.payout_estimate_source !== "string" ||
      context.payout_estimate_source.trim() === ""
    )
  ) {
    throw new TypeError(
      `${location}: payout_estimate_source must be a non-empty string or null.`
    );
  }
}

export function validateDataset(dataset) {
  if (!Array.isArray(dataset) || dataset.length === 0) {
    throw new TypeError("Dataset must be a non-empty array.");
  }

  const scenarioIds = new Set();
  const responseIds = new Set();

  for (const scenario of dataset) {
    if (!scenario || typeof scenario !== "object" || Array.isArray(scenario)) {
      throw new TypeError("Every scenario must be an object.");
    }

    requireNonEmptyString(scenario.id, "id", "Scenario");
    requireNonEmptyString(scenario.customer_message, "customer_message", scenario.id);

    if (scenarioIds.has(scenario.id)) {
      throw new TypeError(`Duplicate scenario ID: ${scenario.id}`);
    }

    scenarioIds.add(scenario.id);

    validateContext(scenario.context, scenario.id);

    if (!Array.isArray(scenario.responses) || scenario.responses.length === 0) {
      throw new TypeError(`${scenario.id}: responses must be a non-empty array.`);
    }

    for (const response of scenario.responses) {
      if (!response || typeof response !== "object" || Array.isArray(response)) {
        throw new TypeError(`${scenario.id}: every response must be an object.`);
      }

      requireNonEmptyString(response.response_id, "response_id", scenario.id);
      requireNonEmptyString(response.text, "text", response.response_id);

      const uniqueResponseId = JSON.stringify([scenario.id, response.response_id]);

      if (responseIds.has(uniqueResponseId)) {
        throw new TypeError(`Duplicate response ID: ${uniqueResponseId}`);
      }

      responseIds.add(uniqueResponseId);

      for (const field of [
        "expected_verdict",
        "expected_tracking_verdict",
        "expected_status_verdict"
      ]) {
        if (!VALID_VERDICTS.includes(response[field])) {
          throw new TypeError(
            `${response.response_id}: missing or invalid ${field}.`
          );
        }
      }
    }
  }

  return {
    scenarios: scenarioIds.size,
    responses: responseIds.size
  };
}
