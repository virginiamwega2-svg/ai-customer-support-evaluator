export function createSafeEvaluationError(error, scenarioId, responseId) {
  const status = Number.isInteger(error?.status)
    ? ` (HTTP ${error.status})`
    : "";

  return new Error(
    `LLM evaluation failed for ${scenarioId}/${responseId}${status}. Raw error details were omitted.`
  );
}
