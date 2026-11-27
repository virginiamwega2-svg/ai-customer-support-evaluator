import { readFileSync } from "node:fs";
import { runBenchmark } from "./benchmark-engine.js";

const useHeldout = process.argv.includes("--heldout");
const datasetFile = useHeldout
  ? "./customer-support-heldout.json"
  : "./customer-support-dataset.json";

const dataset = JSON.parse(
  readFileSync(new URL(datasetFile, import.meta.url), "utf8")
);

const benchmark = runBenchmark(dataset);

function formatPercentage(value) {
  return value === null ? "N/A" : `${value.toFixed(2)}%`;
}

console.log("AI CUSTOMER SUPPORT EVALUATOR");
console.log(useHeldout ? "HELD-OUT EVALUATION" : "BASELINE BENCHMARK");
console.log(
  `${benchmark.scenarioCount} scenarios | ${benchmark.responseCount} responses`
);

for (const dimension of benchmark.dimensions) {
  const counts = dimension.confusionMatrix;

  console.log(`\n--- ${dimension.label} ---`);
  console.log(`Total responses: ${dimension.totalResponses}`);
  console.log(`Actual pass verdicts: ${dimension.verdictCounts.pass}`);
  console.log(`Actual fail verdicts: ${dimension.verdictCounts.fail}`);
  console.log(`Actual unknown verdicts: ${dimension.verdictCounts.unknown}`);

  console.log("\nThree-way verdict evaluation:");
  console.log(`Exact verdict matches: ${dimension.exactMatches}`);
  console.log(
    `Exact verdict accuracy: ${formatPercentage(dimension.exactAccuracy)}`
  );

  console.log("\nAbstention evaluation:");
  console.log(`Correct abstentions: ${dimension.correctAbstentions}`);
  console.log(
    `Unnecessary abstentions: ${dimension.unnecessaryAbstentions}`
  );
  console.log(`Missed abstentions: ${dimension.missedAbstentions}`);

  console.log("\nBinary confusion matrix (definitive cases only):");
  console.log(`True positives: ${counts.truePositive}`);
  console.log(`False positives: ${counts.falsePositive}`);
  console.log(`False negatives: ${counts.falseNegative}`);
  console.log(`True negatives: ${counts.trueNegative}`);

  console.log("\nBinary classification metrics:");
  console.log(`Precision: ${formatPercentage(dimension.precision)}`);
  console.log(`Recall: ${formatPercentage(dimension.recall)}`);
  console.log(`F1 score: ${formatPercentage(dimension.f1)}`);
  console.log(
    `Binary accuracy: ${formatPercentage(dimension.binaryAccuracy)}`
  );

  console.log("\nCoverage:");
  console.log(`Coverage: ${formatPercentage(dimension.coverage)}`);
  console.log(
    `Abstention rate: ${formatPercentage(dimension.abstentionRate)}`
  );
  console.log(
    `Expected definitive cases: ${dimension.expectedDefinitiveCount}`
  );

  console.log("\nVerdict disagreements:");

  if (dimension.disagreements.length === 0) {
    console.log("None");
  } else {
    for (const item of dimension.disagreements) {
      console.log(
        `- ${item.scenarioId}/${item.responseId}: expected ${item.expected.toUpperCase()}, actual ${item.actual.toUpperCase()}`
      );
    }
  }
}
