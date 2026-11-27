import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { createSafeEvaluationError } from "./benchmark-errors.js";

const benchmarkPath = fileURLToPath(
  new URL("./llm-benchmark.js", import.meta.url)
);

function runBenchmark(args) {
  return spawnSync(
    process.execPath,
    [benchmarkPath, ...args],
    {
      encoding: "utf8",
      env: { ...process.env }
    }
  );
}

test("sanitises raw API error messages and sensitive details", () => {
  const error = Object.assign(
    new Error("Sensitive API response and secret-key-value"),
    {
      status: 429,
      headers: { authorization: "secret-key-value" }
    }
  );

  const safeError = createSafeEvaluationError(
    error,
    "REF-001",
    "REF-001-A"
  );

  assert.match(safeError.message, /REF-001\/REF-001-A/);
  assert.match(safeError.message, /HTTP 429/);
  assert.doesNotMatch(safeError.message, /Sensitive API response/);
  assert.doesNotMatch(safeError.message, /secret-key-value/);
});

test("sanitises errors without an HTTP status", () => {
  const safeError = createSafeEvaluationError(
    new Error("Private error details"),
    "REF-002",
    "REF-002-A"
  );

  assert.match(safeError.message, /REF-002\/REF-002-A/);
  assert.doesNotMatch(safeError.message, /Private error details/);
  assert.doesNotMatch(safeError.message, /HTTP/);
});

test("blocks live evaluation without the --live flag", () => {
  const result = runBenchmark([]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Add --live/);
});

test("requires an explicit response limit", () => {
  const result = runBenchmark(["--live"]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /A response limit is required/);
});

test("rejects a zero response limit", () => {
  const result = runBenchmark(["--live", "--limit", "0"]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /positive integer/);
});

test("rejects an unknown command-line argument", () => {
  const result = runBenchmark(["--unexpected"]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown argument/);
});
