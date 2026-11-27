import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { validateDataset } from "./dataset-validation.js";

const dataset = JSON.parse(
  await readFile(
    new URL("./customer-support-dataset.json", import.meta.url),
    "utf8"
  )
);

function copyDataset() {
  return structuredClone(dataset);
}

test("accepts the development dataset", () => {
  assert.deepEqual(validateDataset(dataset), {
    scenarios: 6,
    responses: 20
  });
});

test("rejects an empty dataset", () => {
  assert.throws(() => validateDataset([]), /non-empty array/);
});

test("rejects a scenario without an ID", () => {
  const data = copyDataset();
  delete data[0].id;

  assert.throws(() => validateDataset(data), /id must be a non-empty string/);
});

test("rejects a scenario without a customer message", () => {
  const data = copyDataset();
  data[0].customer_message = "";

  assert.throws(() => validateDataset(data), /customer_message/);
});

test("rejects a missing context", () => {
  const data = copyDataset();
  data[0].context = null;

  assert.throws(() => validateDataset(data), /context must be an object/);
});

test("rejects an invalid refund status", () => {
  const data = copyDataset();
  data[0].context.refund_status = "pending";

  assert.throws(() => validateDataset(data), /invalid refund_status/);
});

test("rejects an invalid payout date", () => {
  const data = copyDataset();
  data[0].context.payout_expected_at = "2026-02-30";

  assert.throws(() => validateDataset(data), /valid YYYY-MM-DD date/);
});

test("rejects an empty response list", () => {
  const data = copyDataset();
  data[0].responses = [];

  assert.throws(() => validateDataset(data), /non-empty array/);
});

test("rejects an empty response text", () => {
  const data = copyDataset();
  data[0].responses[0].text = " ";

  assert.throws(() => validateDataset(data), /text must be a non-empty string/);
});

test("rejects a missing expected verdict", () => {
  const data = copyDataset();
  delete data[0].responses[0].expected_verdict;

  assert.throws(() => validateDataset(data), /expected_verdict/);
});

test("rejects duplicate scenario IDs", () => {
  const data = copyDataset();
  data[1].id = data[0].id;

  assert.throws(() => validateDataset(data), /Duplicate scenario ID/);
});

test("rejects duplicate response IDs within a scenario", () => {
  const data = copyDataset();
  data[0].responses[1].response_id = data[0].responses[0].response_id;

  assert.throws(() => validateDataset(data), /Duplicate response ID/);
});

test("distinguishes response IDs when scenario IDs contain separators", () => {
  const data = copyDataset();

  data[0].id = "scenario/one";
  data[0].responses[0].response_id = "response";

  data[1].id = "scenario";
  data[1].responses[0].response_id = "one/response";

  assert.doesNotThrow(() => validateDataset(data));
});
