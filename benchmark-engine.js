import { validateDataset } from "./dataset-validation.js";

import {
  evaluateRefundPromise,
  evaluateTrackingInstruction,
  evaluateRefundStatus
} from "./customer-support-evaluator.js";

const DIMENSIONS = [
  {
    key: "refundPromise",
    label: "Refund promise accuracy",
    expectedKey: "expected_verdict",
    evaluate: evaluateRefundPromise
  },
  {
    key: "trackingInstruction",
    label: "Tracking instruction accuracy",
    expectedKey: "expected_tracking_verdict",
    evaluate: evaluateTrackingInstruction
  },
  {
    key: "refundStatus",
    label: "Refund status consistency",
    expectedKey: "expected_status_verdict",
    evaluate: evaluateRefundStatus
  }
];

const VALID_VERDICTS = ["pass", "fail", "unknown"];

function percentage(numerator, denominator) {
  return denominator === 0
    ? null
    : (numerator / denominator) * 100;
}

function calculateDimension(dataset, dimension) {
  const confusionMatrix = {
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

  const responses = [];

  for (const scenario of dataset) {
    for (const response of scenario.responses) {
      const expectedVerdict = response[dimension.expectedKey];

      if (!VALID_VERDICTS.includes(expectedVerdict)) {
        throw new Error(
          `Missing or invalid expected verdict: ${scenario.id}/${response.response_id}`
        );
      }

      const result = dimension.evaluate(response.text, scenario.context);

      if (!VALID_VERDICTS.includes(result.verdict)) {
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
          scenarioId: scenario.id,
          responseId: response.response_id,
          expected: expectedVerdict,
          actual: actualVerdict
        });
      }

      if (expectedVerdict === "unknown") {
        if (actualVerdict === "unknown") {
          correctAbstentions++;
        } else {
          missedAbstentions++;
        }
      } else if (actualVerdict === "unknown") {
        unnecessaryAbstentions++;
      } else {
        const expectedPass = expectedVerdict === "pass";
        const actualPass = actualVerdict === "pass";

        if (expectedPass && actualPass) {
          confusionMatrix.truePositive++;
        } else if (!expectedPass && actualPass) {
          confusionMatrix.falsePositive++;
        } else if (expectedPass && !actualPass) {
          confusionMatrix.falseNegative++;
        } else {
          confusionMatrix.trueNegative++;
        }
      }

      responses.push({
        scenarioId: scenario.id,
        responseId: response.response_id,
        expectedVerdict,
        actualVerdict,
        result
      });
    }
  }

  const definitiveCount = verdictCounts.pass + verdictCounts.fail;

  const expectedUnknownCount = dataset.reduce(
    (total, scenario) =>
      total +
      scenario.responses.filter(
        (response) => response[dimension.expectedKey] === "unknown"
      ).length,
    0
  );

  const expectedDefinitiveCount = responseCount - expectedUnknownCount;

  const precision = percentage(
    confusionMatrix.truePositive,
    confusionMatrix.truePositive + confusionMatrix.falsePositive
  );

  const recall = percentage(
    confusionMatrix.truePositive,
    confusionMatrix.truePositive + confusionMatrix.falseNegative
  );

  const f1 =
    precision === null ||
    recall === null ||
    precision + recall === 0
      ? null
      : (2 * precision * recall) / (precision + recall);

  const binaryAccuracy = percentage(
    confusionMatrix.truePositive + confusionMatrix.trueNegative,
    confusionMatrix.truePositive +
      confusionMatrix.falsePositive +
      confusionMatrix.falseNegative +
      confusionMatrix.trueNegative
  );

  return {
    key: dimension.key,
    label: dimension.label,
    expectedKey: dimension.expectedKey,
    totalResponses: responseCount,
    verdictCounts,
    exactMatches,
    exactAccuracy: percentage(exactMatches, responseCount),
    correctAbstentions,
    unnecessaryAbstentions,
    missedAbstentions,
    confusionMatrix,
    precision,
    recall,
    f1,
    binaryAccuracy,
    coverage: percentage(definitiveCount, responseCount),
    abstentionRate: percentage(verdictCounts.unknown, responseCount),
    expectedDefinitiveCount,
    disagreements,
    responses
  };
}

export function runBenchmark(dataset) {
  const datasetSummary = validateDataset(dataset);

  const dimensions = DIMENSIONS.map(
    (dimension) => calculateDimension(dataset, dimension)
  );

  const scenarios = dataset.map((scenario) => ({
    id: scenario.id,
    scenario: scenario.scenario,
    customerMessage: scenario.customer_message,
    context: scenario.context,
    expectedBehavior: scenario.expected_behavior ?? null,
    referenceAnswer: scenario.reference_answer ?? null,
    responses: scenario.responses.map((response) => {
      const evaluations = {};

      for (const dimension of dimensions) {
        const evaluation = dimension.responses.find(
          (item) =>
            item.scenarioId === scenario.id &&
            item.responseId === response.response_id
        );

        evaluations[dimension.key] = {
          expectedVerdict: evaluation.expectedVerdict,
          actualVerdict: evaluation.actualVerdict,
          result: evaluation.result
        };
      }

      return {
        responseId: response.response_id,
        text: response.text,
        evaluations
      };
    })
  }));

  return {
    scenarioCount: datasetSummary.scenarios,
    responseCount: datasetSummary.responses,
    dimensions: dimensions.map(({ responses, ...dimension }) => dimension),
    scenarios
  };
}
