
import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateRefundPromise,
  evaluateTrackingInstruction,
  evaluateRefundStatus
} from "./customer-support-evaluator.js";

const dataset = JSON.parse(
  await readFile(
    new URL("./customer-support-dataset.json", import.meta.url),
    "utf8"
  )
);

const context = {
  refund_status: "processing",
  completion_date: null,
  tracking_path: "Orders → Refunds"
};

// Refund promise evaluation tests

test("flags a refund promise when the completion date is unconfirmed", () => {
  const result = evaluateRefundPromise(
    "Your refund will arrive tomorrow.",
    context
  );

  assert.equal(result.passed, false);
});

test("passes a response that does not promise an unconfirmed date", () => {
  const result = evaluateRefundPromise(
    "Your refund is still being processed.",
    context
  );

  assert.equal(result.passed, true);
});

test("rejects an invalid response", () => {
  assert.throws(
    () => evaluateRefundPromise(null, context),
    {
      name: "TypeError",
      message: "A valid AI response is required."
    }
  );
});

test("flags a promise of arrival by Friday when the date is unconfirmed", () => {
  const result = evaluateRefundPromise(
    "Your refund should arrive by Friday.",
    context
  );

  assert.equal(result.passed, false);
});

test("flags an expected refund timeframe when the date is unconfirmed", () => {
  const result = evaluateRefundPromise(
    "You can expect your refund in two days.",
    context
  );

  assert.equal(result.passed, false);
});

test("allows a refund timeframe when the completion date is confirmed", () => {
  const confirmedContext = {
    refund_status: "processing",
    completion_date: "2026-11-13",
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(
    "Your refund will arrive on Friday.",
    confirmedContext
  );

  assert.equal(result.passed, true);
});

test("flags a refund promise that conflicts with the confirmed date", () => {
  const confirmedContext = {
    refund_status: "processing",
    completion_date: "2026-11-13",
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(
    "Your refund will arrive next Monday.",
    confirmedContext
  );

  assert.equal(result.passed, false);
});

test("rejects an invalid confirmed completion date", () => {
  const invalidDateContext = {
    refund_status: "processing",
    completion_date: "not-a-real-date",
    tracking_path: "Orders → Refunds"
  };

  assert.throws(
    () => evaluateRefundPromise(
      "Your refund will arrive next Monday.",
      invalidDateContext
    ),
    {
      name: "TypeError",
      message: "A valid confirmed completion date is required."
    }
  );
});

test("rejects an impossible calendar completion date", () => {
  const invalidDateContext = {
    refund_status: "processing",
    completion_date: "2026-02-31",
    tracking_path: "Orders → Refunds"
  };

  assert.throws(
    () => evaluateRefundPromise(
      "Your refund will arrive next Monday.",
      invalidDateContext
    ),
    {
      name: "TypeError",
      message: "A valid confirmed completion date is required."
    }
  );
});

test("flags a refund promise with a conflicting calendar date", () => {
  const confirmedContext = {
    refund_status: "processing",
    completion_date: "2026-11-13",
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(
    "Your refund will arrive on November 16, 2026.",
    confirmedContext
  );

  assert.equal(result.passed, false);
});

test("flags a specific calendar date when no completion date is confirmed", () => {
  const result = evaluateRefundPromise(
    "Your refund will arrive on November 16, 2026.",
    context
  );

  assert.equal(result.passed, false);
});
test("flags an impossible promised calendar date", () => {
  const result = evaluateRefundPromise(
    "Your refund will arrive on February 31, 2026.",
    context
  );

  assert.equal(result.passed, false);
});
test("flags an impossible promised date even when it normalizes to the confirmed date", () => {
  const confirmedContext = {
    ...context,
    completion_date: "2026-03-03"
  };

  const result = evaluateRefundPromise(
    "Your refund will arrive on February 31, 2026.",
    confirmedContext
  );

  assert.equal(result.passed, false);
});

test("allows the exact confirmed calendar date", () => {
  const confirmedContext = {
    refund_status: "processing",
    completion_date: "2026-11-13",
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(
    "Your refund will arrive on November 13, 2026.",
    confirmedContext
  );

  assert.equal(result.passed, true);
});

// Tracking instruction evaluation tests

test("passes when the response includes the verified tracking path", () => {
  const result = evaluateTrackingInstruction(
    "You can check for updates under Orders → Refunds.",
    context
  );

  assert.equal(result.passed, true);
});

test("fails when the response omits the verified tracking path", () => {
  const result = evaluateTrackingInstruction(
    "You can check your refund status in your account.",
    context
  );

  assert.equal(result.passed, false);
});

test("rejects a missing verified tracking path", () => {
  const invalidContext = {
    refund_status: "processing",
    completion_date: null,
    tracking_path: ""
  };

  assert.throws(
    () => evaluateTrackingInstruction(
      "Check your refund status.",
      invalidContext
    ),
    {
      name: "TypeError",
      message: "A verified tracking path is required."
    }
  );
});

// Dataset-driven evaluation tests

 // Dataset-driven evaluation tests

for (const scenario of dataset) {
  for (const response of scenario.responses) {
    test(
      `${scenario.id}: evaluates refund promise for response ${response.response_id}`,
      () => {
        const result = evaluateRefundPromise(
          response.text,
          scenario.context
        );

        assert.equal(result.passed, response.expected_passed);
      }
    );

    test(
      `${scenario.id}: evaluates tracking instruction for response ${response.response_id}`,
      () => {
        const result = evaluateTrackingInstruction(
          response.text,
          scenario.context
        );

        assert.equal(
          result.passed,
          response.expected_tracking_passed
        );
      }
    );

    test(
      `${scenario.id}: evaluates refund status for response ${response.response_id}`,
      () => {
        const result = evaluateRefundStatus(
          response.text,
          scenario.context
        );

        assert.equal(
          result.passed,
          response.expected_status_passed
        );
      }
    );
  }
}

// Refund status evaluation tests
test("passes when the response matches the verified processing status", () => {
  const result = evaluateRefundStatus(
    "Your refund is still being processed.",
    context
  );

  assert.equal(result.passed, true);
});

test("fails when the response claims a processing refund is completed", () => {
  const result = evaluateRefundStatus(
    "Your refund has been completed.",
    context
  );

  assert.equal(result.passed, false);
});

test("fails when the response claims a processing refund has failed", () => {
  const result = evaluateRefundStatus(
    "Your refund has failed.",
    context
  );

  assert.equal(result.passed, false);
});

test("passes when a completed refund is described as completed", () => {
  const result = evaluateRefundStatus(
    "Your refund has been completed.",
    { ...context, refund_status: "completed" }
  );

  assert.equal(result.passed, true);
});

test("passes when a failed refund is described as failed", () => {
  const result = evaluateRefundStatus(
    "Your refund has failed.",
    { ...context, refund_status: "failed" }
  );

  assert.equal(result.passed, true);
});

test("does not flag a negated completion claim", () => {
  const result = evaluateRefundStatus(
    "Your refund has not been completed yet; it is still being processed.",
    context
  );

  assert.equal(result.passed, true);
});

test("flags a completed refund claim expressed as successfully processed", () => {
  const result = evaluateRefundStatus(
    "Your refund has been processed successfully.",
    context
  );

  assert.equal(result.passed, false);
});
test("does not flag a negated successfully processed claim", () => {
  const result = evaluateRefundStatus(
    "Your refund has not been processed successfully; it is still being processed.",
    context
  );

  assert.equal(result.passed, true);
});

test("rejects an unsupported verified refund status", () => {
  assert.throws(
    () => evaluateRefundStatus(
      "Your refund is being processed.",
      { ...context, refund_status: "unknown" }
    ),
    {
      name: "TypeError",
      message: "A valid verified refund status is required."
    }
  );
});
test("does not flag a negated failure claim", () => {
  const result = evaluateRefundStatus(
    "Your refund has not failed. It is still being processed.",
    context
  );

  assert.equal(result.passed, true);
});
test("does not flag an unrelated calendar date as a refund arrival promise", () => {
  const result = evaluateRefundPromise(
    "Your refund is still being processed. Our support team will contact you on November 16, 2026, with an update.",
    context
  );

  assert.equal(result.passed, true);
});
test("does not flag an unrelated weekday as a conflicting refund date", () => {
  const confirmedContext = {
    refund_status: "processing",
    completion_date: "2026-11-13",
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(
    "Your refund is still being processed. Our support team will contact you on Monday with an update.",
    confirmedContext
  );

  assert.equal(result.passed, true);
});
test("accepts a readable tracking instruction that expresses the verified path", () => {
  const result = evaluateTrackingInstruction(
    "Open Orders, then select Refunds to check your refund.",
    context
  );

  assert.equal(result.passed, true);
});
test("rejects a tracking instruction that gives the verified steps in the wrong order", () => {
  const result = evaluateTrackingInstruction(
    "Select Refunds, then open Orders.",
    context
  );

  assert.equal(result.passed, false);
});
test("rejects a tracking instruction that includes only part of the verified path", () => {
  const result = evaluateTrackingInstruction(
    "Open Orders to check your refund.",
    context
  );

  assert.equal(result.passed, false);
});
test("flags a completed refund that is incorrectly described as processing", () => {
  const result = evaluateRefundStatus(
    "Your refund is still being processed.",
    {
      refund_status: "completed",
      completion_date: "2026-11-10",
      tracking_path: "Orders → Refunds"
    }
  );

  assert.equal(result.passed, false);
});
test("flags a completed refund response that gives the wrong completion date", () => {
  const result = evaluateRefundPromise(
    "Your refund will be completed on November 12, 2026.",
    {
      refund_status: "completed",
      completion_date: "2026-11-10",
      tracking_path: "Orders → Refunds"
    }
  );

  assert.equal(result.passed, false);
});
test("flags an impossible refund completion date", () => {
  const result = evaluateRefundPromise(
    "Your refund was completed on November 32, 2026.",
    {
      refund_status: "completed",
      completion_date: "2026-11-10",
      tracking_path: "Orders → Refunds"
    }
  );

  assert.equal(result.passed, false);
});