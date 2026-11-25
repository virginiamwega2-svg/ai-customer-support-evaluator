import { readFileSync } from "node:fs";

import {
  evaluateRefundPromise,
  evaluateTrackingInstruction,
  evaluateRefundStatus
} from "./customer-support-evaluator.js";

const useHeldout = process.argv.includes("--heldout");
const datasetFile = useHeldout
  ? "./customer-support-heldout.json"
  : "./customer-support-dataset.json";

const dataset = JSON.parse(
  readFileSync(new URL(datasetFile, import.meta.url), "utf8")
);

const dimensions = [
  {
    label: "Refund promise accuracy",
    expectedKey: "expected_verdict",
    evaluate: evaluateRefundPromise
  },
  {
    label: "Tracking instruction accuracy",
    expectedKey: "expected_tracking_verdict",
    evaluate: evaluateTrackingInstruction
  },
  {
    label: "Refund status consistency",
    expectedKey: "expected_status_verdict",
    evaluate: evaluateRefundStatus
  }
];

const validVerdicts = ["pass", "fail", "unknown"];

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
console.log(useHeldout ? "HELD-OUT EVALUATION" : "BASELINE BENCHMARK");
console.log(`${dataset.length} scenarios | ${totalResponses} responses`);

for (const dimension of dimensions) {
  const counts = {
    truePositive: 0,
    falsePositive: 0,
    falseNegative: 0,
    trueNegative: 0
  };

  const verdictCounts = {
    pass: 0,
    fail: 0,
    unknown: 0
  };

  let correctAbstentions = 0;
  let unnecessaryAbstentions = 0;
  let missedAbstentions = 0;
  let exactMatches = 0;
  let responseCount = 0;

  const disagreements = [];

  for (const scenario of dataset) {
    for (const response of scenario.responses) {
      const expectedVerdict = response[dimension.expectedKey];

      if (!validVerdicts.includes(expectedVerdict)) {
        throw new Error(
          `Missing or invalid expected verdict: ${scenario.id}/${response.response_id}`
        );
      }

      const result = dimension.evaluate(
        response.text,
        scenario.context
      );

      if (!validVerdicts.includes(result.verdict)) {
        throw new Error(
          `Invalid evaluator verdict: ${scenario.id}/${response.response_id}`
        );
      }

      const actualVerdict = result.verdict;

      responseCount++;
      verdictCounts[actualVerdict]++;

      if (expectedVerdict === actualVerdict) {
        exactMatches++;
      } else {
        disagreements.push({
          scenario: scenario.id,
          response: response.response_id,
          expected: expectedVerdict.toUpperCase(),
          actual: actualVerdict.toUpperCase()
        });
      }

      if (expectedVerdict === "unknown") {
        if (actualVerdict === "unknown") {
          correctAbstentions++;
        } else {
          missedAbstentions++;
        }

        continue;
      }

      if (actualVerdict === "unknown") {
        unnecessaryAbstentions++;
        continue;
      }

      const expectedPass = expectedVerdict === "pass";
      const actualPass = actualVerdict === "pass";

      if (expectedPass && actualPass) {
        counts.truePositive++;
      } else if (!expectedPass && actualPass) {
        counts.falsePositive++;
      } else if (expectedPass && !actualPass) {
        counts.falseNegative++;
      } else {
        counts.trueNegative++;
      }
    }
  }

  const definitiveCount =
    verdictCounts.pass + verdictCounts.fail;

  const expectedDefinitiveCount =
    responseCount -
    dataset.reduce(
      (total, scenario) =>
        total +
        scenario.responses.filter(
          (response) => response[dimension.expectedKey] === "unknown"
        ).length,
      0
    );

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
    counts.truePositive +
      counts.falsePositive +
      counts.falseNegative +
      counts.trueNegative
  );

  const exactAccuracy = percentage(exactMatches, responseCount);
  const coverage = percentage(definitiveCount, responseCount);
  const abstentionRate = percentage(
    verdictCounts.unknown,
    responseCount
  );

  console.log(`\n--- ${dimension.label} ---`);
  console.log(`Total responses: ${responseCount}`);
  console.log(`Actual pass verdicts: ${verdictCounts.pass}`);
  console.log(`Actual fail verdicts: ${verdictCounts.fail}`);
  console.log(`Actual unknown verdicts: ${verdictCounts.unknown}`);

  console.log("\nThree-way verdict evaluation:");
  console.log(`Exact verdict matches: ${exactMatches}`);
  console.log(`Exact verdict accuracy: ${formatPercentage(exactAccuracy)}`);

  console.log("\nAbstention evaluation:");
  console.log(`Correct abstentions: ${correctAbstentions}`);
  console.log(`Unnecessary abstentions: ${unnecessaryAbstentions}`);
  console.log(`Missed abstentions: ${missedAbstentions}`);

  console.log("\nBinary confusion matrix (definitive cases only):");
  console.log(`True positives: ${counts.truePositive}`);
  console.log(`False positives: ${counts.falsePositive}`);
  console.log(`False negatives: ${counts.falseNegative}`);
  console.log(`True negatives: ${counts.trueNegative}`);

  console.log("\nBinary classification metrics:");
  console.log(`Precision: ${formatPercentage(precision)}`);
  console.log(`Recall: ${formatPercentage(recall)}`);
  console.log(`F1 score: ${formatPercentage(f1)}`);
  console.log(`Binary accuracy: ${formatPercentage(accuracy)}`);

  console.log("\nCoverage:");
  console.log(`Coverage: ${formatPercentage(coverage)}`);
  console.log(`Abstention rate: ${formatPercentage(abstentionRate)}`);
  console.log(`Expected definitive cases: ${expectedDefinitiveCount}`);

  console.log("\nVerdict disagreements:");

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
