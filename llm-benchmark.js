import fs from "node:fs";
import { validateDataset } from "./dataset-validation.js";
import { performance } from "node:perf_hooks";
import { evaluateWithLLM } from "./llm-judge.js";
import { createSafeEvaluationError } from "./benchmark-errors.js";

const args = process.argv.slice(2);
const live = args.includes("--live");
const useHeldout = args.includes("--heldout");

let limit = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--live" || args[i] === "--heldout") {
    continue;
  }

  if (args[i] === "--limit") {
    const value = args[i + 1];

    if (!value || value.startsWith("--")) {
      throw new Error("--limit requires a positive integer.");
    }

    limit = Number(value);

    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("--limit must be a positive integer.");
    }

    i++;
    continue;
  }

  throw new Error(`Unknown argument: ${args[i]}`);
}

if (!live) {
  throw new Error(
    "Live evaluation is disabled. Add --live to confirm API usage and charges."
  );
}

if (limit === null) {
  throw new Error(
    "A response limit is required for live evaluation. Add --limit N to specify the maximum number of API requests."
  );
}

if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_JUDGE_MODEL) {
  throw new Error("OPENAI_API_KEY and OPENAI_JUDGE_MODEL must be configured.");
}

const datasetFile = useHeldout
  ? "./customer-support-heldout.json"
  : "./customer-support-dataset.json";

const dataset = JSON.parse(
  fs.readFileSync(new URL(datasetFile, import.meta.url), "utf8")
);

validateDataset(dataset);

const evaluations = dataset.flatMap((scenario) =>
  scenario.responses.map((response) => ({
    scenario,
    response
  }))
);

const selectedEvaluations = limit === null
  ? evaluations
  : evaluations.slice(0, limit);

if (selectedEvaluations.length === 0) {
  throw new Error("No responses available for evaluation.");
}

const dimensions = [
  {
    label: "Refund promise accuracy",
    expectedKey: "expected_verdict",
    resultKey: "refund_promise"
  },
  {
    label: "Tracking instruction accuracy",
    expectedKey: "expected_tracking_verdict",
    resultKey: "tracking_instruction"
  },
  {
    label: "Refund status consistency",
    expectedKey: "expected_status_verdict",
    resultKey: "refund_status"
  }
];

const validVerdicts = ["pass", "fail", "unknown"];

const counts = Object.fromEntries(
  dimensions.map((dimension) => [
    dimension.resultKey,
    {
      exactMatches: 0,
      disagreements: 0,
      total: 0
    }
  ])
);

const performanceMetrics = {
  totalLatencyMs: 0,
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  tokenUsageAvailable: true
};

console.log("AI CUSTOMER SUPPORT LLM JUDGE");
console.log(useHeldout ? "HELD-OUT EVALUATION" : "DEVELOPMENT EVALUATION");
console.log(`Model: ${process.env.OPENAI_JUDGE_MODEL}`);
console.log(`Scenarios available: ${dataset.length}`);
console.log(`Responses selected: ${selectedEvaluations.length}`);
console.log("Live API evaluation enabled.");

for (const { scenario, response } of selectedEvaluations) {
  const startTime = performance.now();

  let result;

  try {
    result = await evaluateWithLLM({
      customer_message: scenario.customer_message,
      context: scenario.context,
      candidate_response: response.text
    });
  } catch (error) {
    throw createSafeEvaluationError(error, scenario.id, response.response_id);
  }

  const latencyMs = performance.now() - startTime;
  performanceMetrics.totalLatencyMs += latencyMs;

  const usage = result.usage;

  if (
    usage &&
    Number.isFinite(usage.input_tokens) &&
    Number.isFinite(usage.output_tokens)
  ) {
    performanceMetrics.inputTokens += usage.input_tokens;
    performanceMetrics.outputTokens += usage.output_tokens;
    performanceMetrics.totalTokens +=
      usage.input_tokens + usage.output_tokens;
  } else {
    performanceMetrics.tokenUsageAvailable = false;
  }

  console.log(`\n${scenario.id}/${response.response_id}`);
  console.log(`Latency: ${latencyMs.toFixed(2)} ms`);

  for (const dimension of dimensions) {
    const actualVerdict = result[dimension.resultKey].verdict;
    const expectedVerdict = response[dimension.expectedKey];

    if (!validVerdicts.includes(expectedVerdict)) {
      throw new Error(
        `Invalid expected verdict: ${scenario.id}/${response.response_id}`
      );
    }

    if (!validVerdicts.includes(actualVerdict)) {
      throw new Error(
        `Invalid LLM verdict: ${scenario.id}/${response.response_id}`
      );
    }

    const dimensionCounts = counts[dimension.resultKey];

    dimensionCounts.total++;

    if (actualVerdict === expectedVerdict) {
      dimensionCounts.exactMatches++;
    } else {
      dimensionCounts.disagreements++;
    }

    console.log(
      `${dimension.label}: expected=${expectedVerdict}, LLM=${actualVerdict}`
    );
  }
}

const averageLatencyMs =
  performanceMetrics.totalLatencyMs / selectedEvaluations.length;

console.log("\nLLM JUDGE RESULTS");

for (const dimension of dimensions) {
  const result = counts[dimension.resultKey];
  const accuracy = (result.exactMatches / result.total) * 100;

  console.log(`\n${dimension.label}`);
  console.log(`Exact matches: ${result.exactMatches}/${result.total}`);
  console.log(`Disagreements: ${result.disagreements}`);
  console.log(`Exact agreement: ${accuracy.toFixed(2)}%`);
}

console.log("\nPERFORMANCE MEASUREMENTS");
console.log(
  `Total evaluation latency: ${performanceMetrics.totalLatencyMs.toFixed(2)} ms`
);
console.log(`Average latency per response: ${averageLatencyMs.toFixed(2)} ms`);

if (performanceMetrics.tokenUsageAvailable) {
  console.log(`Input tokens: ${performanceMetrics.inputTokens}`);
  console.log(`Output tokens: ${performanceMetrics.outputTokens}`);
  console.log(`Total tokens: ${performanceMetrics.totalTokens}`);
} else {
  console.log("Token usage: unavailable for one or more responses.");
}

console.log("\nEvaluation completed.");
