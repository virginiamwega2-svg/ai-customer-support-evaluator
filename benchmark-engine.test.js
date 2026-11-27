import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { runBenchmark } from "./benchmark-engine.js";

async function loadDataset(filename) {
  return JSON.parse(
    await readFile(new URL(filename, import.meta.url), "utf8")
  );
}

test("calculates development benchmark metrics", async () => {
  const dataset = await loadDataset("./customer-support-dataset.json");
  const result = runBenchmark(dataset);

  assert.equal(result.scenarioCount, 6);
  assert.equal(result.responseCount, 20);
  assert.equal(result.dimensions.length, 3);

  for (const dimension of result.dimensions) {
    assert.equal(dimension.totalResponses, 20);
    assert.equal(dimension.exactMatches, 20);
    assert.equal(dimension.exactAccuracy, 100);
  }

  assert.equal(result.dimensions[0].coverage, 65);
  assert.equal(result.dimensions[0].abstentionRate, 35);

  assert.equal(result.dimensions[1].coverage, 100);
  assert.equal(result.dimensions[1].abstentionRate, 0);

  assert.equal(result.dimensions[2].coverage, 85);
  assert.equal(result.dimensions[2].abstentionRate, 15);
});

test("calculates held-out benchmark metrics independently", async () => {
  const dataset = await loadDataset("./customer-support-heldout.json");
  const result = runBenchmark(dataset);

  assert.equal(result.scenarioCount, 3);
  assert.equal(result.responseCount, 3);

  for (const dimension of result.dimensions) {
    assert.equal(dimension.totalResponses, 3);
    assert.equal(dimension.exactMatches, 3);
    assert.equal(dimension.exactAccuracy, 100);
    assert.equal(dimension.coverage, 100);
    assert.equal(dimension.abstentionRate, 0);
  }
});

test("includes response-level verdicts and evaluator evidence", async () => {
  const dataset = await loadDataset("./customer-support-dataset.json");
  const result = runBenchmark(dataset);

  const scenario = result.scenarios[0];
  const response = scenario.responses[0];

  assert.ok(scenario.id);
  assert.ok(scenario.customerMessage);
  assert.ok(response.responseId);
  assert.ok(response.text);

  for (const key of [
    "refundPromise",
    "trackingInstruction",
    "refundStatus"
  ]) {
    const evaluation = response.evaluations[key];

    assert.ok(["pass", "fail", "unknown"].includes(
      evaluation.expectedVerdict
    ));

    assert.ok(["pass", "fail", "unknown"].includes(
      evaluation.actualVerdict
    ));

    assert.ok(evaluation.result.reason);
    if (evaluation.result.evidence !== undefined) {
      assert.ok(Array.isArray(evaluation.result.evidence));
    }
  }
});

test("rejects an invalid dataset", () => {
  assert.throws(
    () => runBenchmark([]),
    /dataset/i
  );
});
