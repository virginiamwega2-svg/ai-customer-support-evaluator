import { readFileSync } from "node:fs";

import {
  evaluateRefundPromise,
  evaluateTrackingInstruction,
  evaluateRefundStatus
} from "./customer-support-evaluator.js";

const dataset = JSON.parse(
  readFileSync(
    new URL("./customer-support-dataset.json", import.meta.url),
    "utf8"
  )
);

const dimensions = [
  {
    label: "Refund promise accuracy",
    expectedKey: "expected_passed",
    evaluate: evaluateRefundPromise
  },
  {
    label: "Tracking instruction accuracy",
    expectedKey: "expected_tracking_passed",
    evaluate: evaluateTrackingInstruction
  },
  {
    label: "Refund status consistency",
    expectedKey: "expected_status_passed",
    evaluate: evaluateRefundStatus
  }
];

function percentage(numerator, denominator) {
  return denominator === 0
    ? null
    : (numerator / denominator) * 100;
}

function formatPercentage(value) {
  return value === null ? "N/A" : `${value.toFixed(2)}%`;
}

const totalResponses = dataset.reduce(
  (total, scenario) => total + scenario.responses.length,
  0
);

console.log("AI CUSTOMER SUPPORT EVALUATOR");
console.log("BASELINE BENCHMARK");
console.log(`${dataset.length} scenarios | ${totalResponses} responses`);

for (const dimension of dimensions) {
  const counts = {
    truePositive: 0,
    falsePositive: 0,
    falseNegative: 0,
    trueNegative: 0
  };

  let unknownCount = 0;
  let unknownExpectedPass = 0;
  let unknownExpectedNotPass = 0;
  let responseCount = 0;

  const disagreements = [];

  for (const scenario of dataset) {
    for (const response of scenario.responses) {
      const expectedPass = response[dimension.expectedKey];

      if (typeof expectedPass !== "boolean") {
        throw new Error(
          `Missing or invalid expected label: ${scenario.id}/${response.response_id}`
        );
      }

      const result = dimension.evaluate(
        response.text,
        scenario.context
      );

      if (!["pass", "fail", "unknown"].includes(result.verdict)) {
        throw new Error(
          `Invalid evaluator verdict: ${scenario.id}/${response.response_id}`
        );
      }

      responseCount++;

      if (result.verdict === "unknown") {
        unknownCount++;

        if (expectedPass) {
          unknownExpectedPass++;
        } else {
          unknownExpectedNotPass++;
        }

        continue;
      }

      const actualPass = result.verdict === "pass";

      if (expectedPass && actualPass) {
        counts.truePositive++;
      } else if (!expectedPass && actualPass) {
        counts.falsePositive++;
      } else if (expectedPass && !actualPass) {
        counts.falseNegative++;
      } else {
        counts.trueNegative++;
      }

      if (expectedPass !== actualPass) {
        disagreements.push({
          scenario: scenario.id,
          response: response.response_id,
          expected: expectedPass ? "PASS" : "NOT PASS",
          actual: result.verdict.toUpperCase()
        });
      }
    }
  }

  const definitiveCount = responseCount - unknownCount;

  const precision = percentage(
    counts.truePositive,
    counts.truePositive + counts.falsePositive
  );

  const recall = percentage(
    counts.truePositive,
    counts.truePositive + counts.falseNegative
  );

  const f1 =
    precision === null ||
    recall === null ||
    precision + recall === 0
      ? null
      : (2 * precision * recall) / (precision + recall);

  const accuracy = percentage(
    counts.truePositive + counts.trueNegative,
    definitiveCount
  );

  const coverage = percentage(definitiveCount, responseCount);
  const abstentionRate = percentage(unknownCount, responseCount);

  console.log(`\n--- ${dimension.label} ---`);
  console.log(`Total responses: ${responseCount}`);
  console.log(`Definitive verdicts: ${definitiveCount}`);
  console.log(`True positives: ${counts.truePositive}`);
  console.log(`False positives: ${counts.falsePositive}`);
  console.log(`False negatives: ${counts.falseNegative}`);
  console.log(`True negatives: ${counts.trueNegative}`);
  console.log(`Unknown verdicts: ${unknownCount}`);
  console.log(`Unknowns expected to pass: ${unknownExpectedPass}`);
  console.log(`Unknowns expected not to pass: ${unknownExpectedNotPass}`);
  console.log(`Coverage: ${formatPercentage(coverage)}`);
  console.log(`Abstention rate: ${formatPercentage(abstentionRate)}`);
  console.log(`Precision: ${formatPercentage(precision)}`);
  console.log(`Recall: ${formatPercentage(recall)}`);
  console.log(`F1 score: ${formatPercentage(f1)}`);
  console.log(`Accuracy: ${formatPercentage(accuracy)}`);

  console.log("Definitive classification disagreements:");

  if (disagreements.length === 0) {
    console.log("None");
  } else {
    for (const item of disagreements) {
      console.log(
        `- ${item.scenario}/${item.response}: expected ${item.expected}, actual ${item.actual}`
      );
    }
  }
}
