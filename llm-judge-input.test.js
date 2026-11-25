import test from "node:test";
import assert from "node:assert/strict";
import { prepareJudgeInput } from "./llm-judge-input.js";

const validInput = {
  customer_message: "When will my refund arrive?",
  context: {
    refund_status: "processing",
    tracking_path: "Orders → Refunds",
    refund_completed_at: null,
    payout_expected_at: null,
    payout_estimate_source: null
  },
  candidate_response: "Your refund is being processed."
};

test("accepts valid input with null evidence fields", () => {
  const result = prepareJudgeInput(validInput);

  assert.equal(result.context.refund_completed_at, null);
  assert.equal(result.context.payout_expected_at, null);
  assert.equal(result.context.payout_estimate_source, null);
});

test("rejects a missing customer message", () => {
  assert.throws(
    () => prepareJudgeInput({
      ...validInput,
      customer_message: ""
    }),
    /customer message/
  );
});

test("rejects a missing candidate response", () => {
  assert.throws(
    () => prepareJudgeInput({
      ...validInput,
      candidate_response: ""
    }),
    /candidate response/
  );
});

test("rejects a missing context", () => {
  assert.throws(
    () => prepareJudgeInput({
      ...validInput,
      context: null
    }),
    /Verified refund context/
  );
});

test("rejects an invalid refund status", () => {
  assert.throws(
    () => prepareJudgeInput({
      ...validInput,
      context: {
        ...validInput.context,
        refund_status: "unknown"
      }
    }),
    /verified refund status/
  );
});

test("rejects a missing tracking path", () => {
  assert.throws(
    () => prepareJudgeInput({
      ...validInput,
      context: {
        ...validInput.context,
        tracking_path: ""
      }
    }),
    /tracking path/
  );
});

test("rejects invalid nullable context field values", () => {
  assert.throws(
    () => prepareJudgeInput({
      ...validInput,
      context: {
        ...validInput.context,
        payout_expected_at: 123
      }
    }),
    /payout_expected_at/
  );
});

test("excludes expected labels and reference answers", () => {
  const inputWithExtraFields = {
    ...validInput,
    reference_answer: "A reference answer.",
    expected_behavior: "Expected behaviour.",
    expected_verdict: "pass",
    expected_tracking_verdict: "pass",
    expected_status_verdict: "pass"
  };

  const result = prepareJudgeInput(inputWithExtraFields);

  assert.deepEqual(
    Object.keys(result),
    ["customer_message", "context", "candidate_response"]
  );

  assert.equal("reference_answer" in result, false);
  assert.equal("expected_verdict" in result, false);
});

test("accepts valid YYYY-MM-DD dates", () => {
  const result = prepareJudgeInput({
    ...validInput,
    context: {
      ...validInput.context,
      refund_completed_at: "2026-11-10",
      payout_expected_at: "2026-11-20"
    }
  });

  assert.equal(result.context.refund_completed_at, "2026-11-10");
  assert.equal(result.context.payout_expected_at, "2026-11-20");
});

test("rejects dates in an invalid format", () => {
  assert.throws(
    () => prepareJudgeInput({
      ...validInput,
      context: {
        ...validInput.context,
        refund_completed_at: "10-11-2026"
      }
    }),
    /valid YYYY-MM-DD date/
  );
});

test("rejects impossible calendar dates", () => {
  assert.throws(
    () => prepareJudgeInput({
      ...validInput,
      context: {
        ...validInput.context,
        payout_expected_at: "2026-02-30"
      }
    }),
    /valid YYYY-MM-DD date/
  );
});