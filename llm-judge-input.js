const VALID_REFUND_STATUSES = ["processing", "completed", "failed"];

function isValidDate(value) {
  if (typeof value !== "string") {
    return false;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return date.toISOString().slice(0, 10) === value;
}

export function prepareJudgeInput({
  customer_message,
  context,
  candidate_response
}) {
  if (
    typeof customer_message !== "string" ||
    customer_message.trim() === ""
  ) {
    throw new TypeError("A valid customer message is required.");
  }

  if (
    typeof candidate_response !== "string" ||
    candidate_response.trim() === ""
  ) {
    throw new TypeError("A valid candidate response is required.");
  }

  if (
    !context ||
    typeof context !== "object" ||
    Array.isArray(context)
  ) {
    throw new TypeError("Verified refund context is required.");
  }

  if (!VALID_REFUND_STATUSES.includes(context.refund_status)) {
    throw new TypeError("A valid verified refund status is required.");
  }

  if (
    typeof context.tracking_path !== "string" ||
    context.tracking_path.trim() === ""
  ) {
    throw new TypeError("A verified tracking path is required.");
  }

  const dateFields = [
    "refund_completed_at",
    "payout_expected_at"
  ];

  for (const field of dateFields) {
    const value = context[field];

    if (value !== null && !isValidDate(value)) {
      throw new TypeError(
        `Context field "${field}" must be a valid YYYY-MM-DD date or null.`
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
      'Context field "payout_estimate_source" must be a non-empty string or null.'
    );
  }

  return {
    customer_message,
    context: {
      refund_status: context.refund_status,
      tracking_path: context.tracking_path,
      refund_completed_at: context.refund_completed_at,
      payout_expected_at: context.payout_expected_at,
      payout_estimate_source: context.payout_estimate_source
    },
    candidate_response
  };
}