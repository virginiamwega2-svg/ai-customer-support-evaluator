import test from "node:test";
import assert from "node:assert/strict";
import Ajv2020 from "ajv/dist/2020.js";
import fs from "node:fs";

const schema = JSON.parse(
  fs.readFileSync("./schemas/llm-judge-output.schema.json", "utf8")
);

const ajv = new Ajv2020({ strict: true });
const validate = ajv.compile(schema);

const validResult = {
  refund_promise: {
    verdict: "unknown",
    reason: "The supplied context does not verify a payout arrival date.",
    response_evidence: "Your refund will arrive tomorrow.",
    context_evidence: null
  },
  tracking_instruction: {
    verdict: "pass",
    reason: "The response provides the verified tracking path.",
    response_evidence: "Orders → Refunds",
    context_evidence: "Orders → Refunds"
  },
  refund_status: {
    verdict: "unknown",
    reason: "The response does not make an explicit refund status claim.",
    response_evidence: null,
    context_evidence: "refund_status: processing"
  }
};

test("accepts a valid three-dimension judge result", () => {
  assert.equal(validate(validResult), true);
});

test("rejects a result with a missing dimension", () => {
  const result = structuredClone(validResult);
  delete result.refund_status;

  assert.equal(validate(result), false);
});

test("rejects an invalid verdict", () => {
  const result = structuredClone(validResult);
  result.refund_promise.verdict = "maybe";

  assert.equal(validate(result), false);
});

test("rejects unexpected properties", () => {
  const result = structuredClone(validResult);
  result.refund_promise.confidence = 0.99;

  assert.equal(validate(result), false);
});

test("rejects an empty reason", () => {
  const result = structuredClone(validResult);
  result.refund_promise.reason = "";

  assert.equal(validate(result), false);
});