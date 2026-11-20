
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
  refund_completed_at: null,
  payout_expected_at: null,
  payout_estimate_source: null,
  tracking_path: "Orders → Refunds"
};

// --------------------------------------------------
// Refund promise evaluation tests
// --------------------------------------------------

test("returns unknown when an arrival promise has no verified payout estimate", () => {
  const result = evaluateRefundPromise(
    "Your refund will arrive tomorrow.",
    context
  );

  assert.equal(result.verdict, "unknown");
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

test("returns unknown for an arrival promise by Friday without a verified payout estimate", () => {
  const result = evaluateRefundPromise(
    "Your refund should arrive by Friday.",
    context
  );

  assert.equal(result.verdict, "unknown");
  assert.equal(result.passed, false);
});

test("returns unknown for an expected refund timeframe without a verified payout estimate", () => {
  const result = evaluateRefundPromise(
    "You can expect your refund in two days.",
    context
  );

  assert.equal(result.verdict, "unknown");
  assert.equal(result.passed, false);
});

test("returns unknown when only the refund completion date is confirmed", () => {
  const confirmedContext = {
    refund_status: "processing",
    refund_completed_at: "2026-11-13",
    payout_expected_at: null,
    payout_estimate_source: null,
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(
    "Your refund will arrive on Friday.",
    confirmedContext
  );

  assert.equal(result.verdict, "unknown");
  assert.equal(result.passed, false);
});

test("accepts an arrival promise supported by a verified payout estimate", () => {
  const verifiedPayoutContext = {
    refund_status: "processing",
    refund_completed_at: null,
    payout_expected_at: "2026-11-13",
    payout_estimate_source: "Verified payment processor estimate",
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(
    "Your refund will arrive on November 13, 2026.",
    verifiedPayoutContext
  );

  assert.equal(result.passed, true);
});

test("correctly associates separate completion and arrival dates", () => {
  const verifiedContext = {
    refund_status: "processing",
    refund_completed_at: "2026-11-10",
    payout_expected_at: "2026-11-13",
    payout_estimate_source: "Verified payment processor estimate",
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(
    "Your refund was completed on November 10, 2026. Your money will arrive on November 13, 2026.",
    verifiedContext
  );

  assert.equal(result.passed, true);
});

test("rejects an arrival promise that conflicts with the verified payout date", () => {
  const verifiedPayoutContext = {
    refund_status: "processing",
    refund_completed_at: null,
    payout_expected_at: "2026-11-13",
    payout_estimate_source: "Verified payment processor estimate",
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(
    "Your refund will arrive on Thursday.",
    verifiedPayoutContext
  );

  assert.equal(result.passed, false);
});

test("rejects an invalid confirmed completion date", () => {
  const invalidDateContext = {
    refund_status: "processing",
    refund_completed_at: "not-a-real-date",
    payout_expected_at: null,
    payout_estimate_source: null,
    tracking_path: "Orders → Refunds"
  };

  assert.throws(
    () => evaluateRefundPromise(
      "Your refund will arrive next Monday.",
      invalidDateContext
    ),
    {
      name: "TypeError",
      message: "A valid verified refund completion date is required."
    }
  );
});

test("rejects an impossible calendar completion date", () => {
  const invalidDateContext = {
    refund_status: "processing",
    refund_completed_at: "2026-02-31",
    payout_expected_at: null,
    payout_estimate_source: null,
    tracking_path: "Orders → Refunds"
  };

  assert.throws(
    () => evaluateRefundPromise(
      "Your refund will arrive next Monday.",
      invalidDateContext
    ),
    {
      name: "TypeError",
      message: "A valid verified refund completion date is required."
    }
  );
});

test("rejects an arrival promise with a conflicting verified calendar date", () => {
  const verifiedPayoutContext = {
    refund_status: "processing",
    refund_completed_at: null,
    payout_expected_at: "2026-11-13",
    payout_estimate_source: "Verified payment processor estimate",
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(
    "Your refund will arrive on November 16, 2026.",
    verifiedPayoutContext
  );

  assert.equal(result.passed, false);
});

test("returns unknown for a specific arrival date without a verified payout estimate", () => {
  const result = evaluateRefundPromise(
    "Your refund will arrive on November 16, 2026.",
    context
  );

  assert.equal(result.verdict, "unknown");
  assert.equal(result.passed, false);
});

test("rejects an impossible arrival date despite a verified payout estimate", () => {
  const verifiedPayoutContext = {
    refund_status: "processing",
    refund_completed_at: null,
    payout_expected_at: "2026-11-13",
    payout_estimate_source: "Verified payment processor estimate",
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(
    "Your refund will arrive on February 31, 2026.",
    verifiedPayoutContext
  );

  assert.equal(result.passed, false);
});

test("rejects an impossible arrival date that normalizes to the verified payout date", () => {
  const verifiedPayoutContext = {
    ...context,
    refund_completed_at: null,
    payout_expected_at: "2026-03-03",
    payout_estimate_source: "Verified payment processor estimate"
  };

  const result = evaluateRefundPromise(
    "Your refund will arrive on February 31, 2026.",
    verifiedPayoutContext
  );

  assert.equal(result.passed, false);
});

test("accepts an arrival weekday that matches the verified payout date", () => {
  const verifiedPayoutContext = {
    refund_status: "processing",
    refund_completed_at: null,
    payout_expected_at: "2026-11-13",
    payout_estimate_source: "Verified payment processor estimate",
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(
    "Your refund will arrive on Friday.",
    verifiedPayoutContext
  );

  assert.equal(result.passed, true);
});

test("returns unknown when an arrival date matches the completion date but no payout estimate exists", () => {
  const confirmedContext = {
    refund_status: "processing",
    refund_completed_at: "2026-11-13",
    payout_expected_at: null,
    payout_estimate_source: null,
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(
    "Your refund will arrive on November 13, 2026.",
    confirmedContext
  );

  assert.equal(result.verdict, "unknown");
  assert.equal(result.passed, false);
});

// --------------------------------------------------
test("records evidence for separate refund completion and payout dates", () => {
  const response =
    "Your refund was completed on November 10, 2026. Your money will arrive on November 13, 2026.";

  const result = evaluateRefundPromise(response, {
    refund_completed_at: "2026-11-10",
    payout_expected_at: "2026-11-13",
    payout_estimate_source: "Verified payment processor estimate"
  });

  assert.equal(result.verdict, "pass");
  assert.equal(result.evidence.length, 2);

  assert.deepEqual(
    result.evidence.map((item) => ({
      claimType: item.claimType,
      claimedValue: item.claimedValue,
      verifiedValue: item.verifiedValue,
      verifiedField: item.verifiedField,
      verifiedSource: item.verifiedSource
    })),
    [
      {
        claimType: "refund_completion_date",
        claimedValue: "2026-11-10",
        verifiedValue: "2026-11-10",
        verifiedField: "refund_completed_at",
        verifiedSource: null
      },
      {
        claimType: "payout_arrival_date",
        claimedValue: "2026-11-13",
        verifiedValue: "2026-11-13",
        verifiedField: "payout_expected_at",
        verifiedSource: "Verified payment processor estimate"
      }
    ]
  );

  for (const item of result.evidence) {
    assert.equal(
      response.slice(item.startIndex, item.endIndex),
      item.responseExcerpt
    );
  }
});

test("retains both date evidence records when the completion date is incorrect", () => {
  const response =
    "Your refund was completed on November 11, 2026. Your money will arrive on November 13, 2026.";

  const result = evaluateRefundPromise(response, {
    refund_completed_at: "2026-11-10",
    payout_expected_at: "2026-11-13",
    payout_estimate_source: "Verified payment processor estimate"
  });

  assert.equal(result.verdict, "fail");
  assert.equal(result.evidence.length, 2);

  assert.equal(
    result.evidence[0].claimedValue,
    "2026-11-11"
  );
  assert.equal(
    result.evidence[1].claimedValue,
    "2026-11-13"
  );
  assert.equal(
    result.evidence[1].verifiedValue,
    "2026-11-13"
  );
});

test("records an arrival date as unverified when no payout estimate exists", () => {
  const response =
    "Your money will arrive on November 13, 2026.";

  const result = evaluateRefundPromise(response, {
    refund_completed_at: "2026-11-10",
    payout_expected_at: null,
    payout_estimate_source: null
  });

  assert.equal(result.verdict, "unknown");
  assert.equal(result.evidence.length, 1);

  assert.deepEqual(result.evidence[0], {
    claimType: "payout_arrival_date",
    claimedValue: "2026-11-13",
    verifiedValue: null,
    verifiedField: null,
    verifiedSource: null,
    responseExcerpt: result.evidence[0].responseExcerpt,
    startIndex: result.evidence[0].startIndex,
    endIndex: result.evidence[0].endIndex
  });

  assert.equal(
    response.slice(
      result.evidence[0].startIndex,
      result.evidence[0].endIndex
    ),
    result.evidence[0].responseExcerpt
  );
});

test("rejects a payout expected date when its source is missing", () => {
  assert.throws(
    () => evaluateRefundPromise(
      "Your money will arrive on November 13, 2026.",
      {
        refund_completed_at: "2026-11-10",
        payout_expected_at: "2026-11-13",
        payout_estimate_source: null
      }
    ),
    {
      name: "TypeError",
      message: "A verified payout estimate source is required."
    }
  );
});

test("rejects a payout estimate source when its date is missing", () => {
  assert.throws(
    () => evaluateRefundPromise(
      "Your money will arrive on November 13, 2026.",
      {
        refund_completed_at: "2026-11-10",
        payout_expected_at: null,
        payout_estimate_source: "Verified payment processor estimate"
      }
    ),
    {
      name: "TypeError",
      message: "A payout estimate source cannot be provided without a payout expected date."
    }
  );
});
// Tracking instruction evaluation tests
// --------------------------------------------------

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
    refund_completed_at: null,
    payout_expected_at: null,
    payout_estimate_source: null,
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

// --------------------------------------------------
// Dataset-driven evaluation tests
// --------------------------------------------------

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

// --------------------------------------------------
// Refund status evaluation tests
// --------------------------------------------------

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

test("returns unknown when the response makes no refund status claim", () => {
  const result = evaluateRefundStatus(
    "Thank you for your patience. We are looking into your request.",
    context
  );

  assert.equal(result.verdict, "unknown");
  assert.equal(result.passed, false);
});

test("does not treat a refund request under review as a processing status claim", () => {
  const result = evaluateRefundStatus(
    "Your refund request is being reviewed by our team.",
    context
  );

  assert.equal(result.verdict, "unknown");
  assert.equal(result.passed, false);
});
test("does not treat a refund request being processed as a refund status claim", () => {
  const result = evaluateRefundStatus(
    "Your refund request is being processed by our team.",
    context
  );

  assert.equal(result.verdict, "unknown");
  assert.equal(result.passed, false);
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

// --------------------------------------------------
// Additional regression tests
// --------------------------------------------------

test("does not flag an unrelated calendar date as a refund arrival promise", () => {
  const result = evaluateRefundPromise(
    "Your refund is still being processed. Our support team will contact you on November 16, 2026, with an update.",
    context
  );

  assert.equal(result.passed, true);
});

test("does not treat a later contact date as a refund arrival date", () => {
  const verifiedPayoutContext = {
    refund_status: "processing",
    refund_completed_at: null,
    payout_expected_at: "2026-11-13",
    payout_estimate_source: "Verified payment processor estimate",
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(
    "Your refund will arrive. Our support team will contact you on November 13, 2026.",
    verifiedPayoutContext
  );

  assert.equal(result.passed, false);
  assert.equal(result.verdict, "unknown");
});

test("does not flag an unrelated weekday as a conflicting refund date", () => {
  const confirmedContext = {
    refund_status: "processing",
    refund_completed_at: "2026-11-13",
    payout_expected_at: null,
    payout_estimate_source: null,
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
      refund_completed_at: "2026-11-10",
      payout_expected_at: null,
      payout_estimate_source: null,
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
      refund_completed_at: "2026-11-10",
      payout_expected_at: null,
      payout_estimate_source: null,
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
      refund_completed_at: "2026-11-10",
      payout_expected_at: null,
      payout_estimate_source: null,
      tracking_path: "Orders → Refunds"
    }
  );

  assert.equal(result.passed, false);
});

test("rejects an incorrect completion date even when the arrival date is correct", () => {
  const verifiedContext = {
    refund_status: "processing",
    refund_completed_at: "2026-11-10",
    payout_expected_at: "2026-11-13",
    payout_estimate_source: "Verified payment processor estimate",
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(
    "Your refund was completed on November 11, 2026. Your money will arrive on November 13, 2026.",
    verifiedContext
  );

  assert.equal(result.passed, false);
});

test("rejects an incorrect arrival date even when the completion date is correct", () => {
  const verifiedContext = {
    refund_status: "processing",
    refund_completed_at: "2026-11-10",
    payout_expected_at: "2026-11-13",
    payout_estimate_source: "Verified payment processor estimate",
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(
    "Your refund was completed on November 10, 2026. Your money will arrive on November 14, 2026.",
    verifiedContext
  );

  assert.equal(result.passed, false);
});

test("does not associate an unrelated later date with a refund completion claim", () => {
  const verifiedContext = {
    refund_status: "processing",
    refund_completed_at: null,
    payout_expected_at: null,
    payout_estimate_source: null,
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(
    "Your refund was completed. Our support team will contact you on November 16, 2026.",
    verifiedContext
  );

  assert.equal(result.passed, true);
});

test("returns unknown for a completion date when no verified completion date exists", () => {
  const unverifiedContext = {
    refund_status: "completed",
    refund_completed_at: null,
    payout_expected_at: null,
    payout_estimate_source: null,
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(
    "Your refund was completed on November 10, 2026.",
    unverifiedContext
  );

  assert.equal(result.verdict, "unknown");
  assert.equal(result.passed, false);
});

test("returns unknown when an arrival timeframe cannot be verified against a payout estimate", () => {
  const verifiedPayoutContext = {
    refund_status: "processing",
    refund_completed_at: null,
    payout_expected_at: "2026-11-20",
    payout_estimate_source: "Verified payment processor estimate",
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(
    "Your refund will arrive within three business days.",
    verifiedPayoutContext
  );

  assert.equal(result.verdict, "unknown");
  assert.equal(result.passed, false);
});

test("recognizes a refund described as processed", () => {
  const result = evaluateRefundStatus(
    "Your refund has been processed.",
    { ...context, refund_status: "completed" }
  );

  assert.equal(result.verdict, "pass");
  assert.equal(result.passed, true);
});

test("does not treat a negated processing claim as an affirmative status claim", () => {
  const result = evaluateRefundStatus(
    "Your refund is not being processed.",
    { ...context, refund_status: "completed" }
  );

  assert.equal(result.verdict, "unknown");
  assert.equal(result.passed, false);
});

test("includes evidence for a matching refund status claim", () => {
  const response = "Your refund is still being processed.";

  const result = evaluateRefundStatus(response, context);

  assert.equal(result.verdict, "pass");
  assert.equal(result.evidence.length, 1);
  assert.deepEqual(result.evidence[0], {
    claimType: "refund_status",
    claimedValue: "processing",
    verifiedValue: "processing",
    verifiedField: "refund_status",
    verifiedSource: null,
    responseExcerpt: "refund is still being processed",
    startIndex: response.indexOf("refund"),
    endIndex: response.length - 1
  });
});

test("captures both claims when a response contradicts its verified refund status", () => {
  const response =
    "Your refund has been completed. Your refund is still being processed.";

  const result = evaluateRefundStatus(response, context);

  assert.equal(result.verdict, "fail");
  assert.equal(result.evidence.length, 2);

  assert.deepEqual(
    result.evidence.map((item) => item.claimedValue),
    ["completed", "processing"]
  );

  assert.ok(
    result.evidence.every(
      (item) => item.verifiedValue === "processing"
    )
  );
});

test("records actual evidence when a refund status claim refers back using it", () => {
  const response =
    "Your refund has not failed. It is still being processed.";

  const result = evaluateRefundStatus(response, context);

  assert.equal(result.verdict, "pass");
  assert.equal(result.evidence.length, 1);

  assert.deepEqual(result.evidence[0], {
    claimType: "refund_status",
    claimedValue: "processing",
    verifiedValue: "processing",
    verifiedField: "refund_status",
    verifiedSource: null,
    responseExcerpt: "It is still being processed",
    startIndex: response.indexOf("It"),
    endIndex: response.length - 1
  });
});

test("records evidence for each verified tracking step", () => {
  const response =
    "Open Orders, then select Refunds to check your refund.";

  const result = evaluateTrackingInstruction(response, context);

  assert.equal(result.passed, true);
  assert.equal(result.evidence.length, 2);

  assert.deepEqual(
    result.evidence.map((item) => ({
      claimType: item.claimType,
      claimedValue: item.claimedValue,
      verifiedValue: item.verifiedValue,
      verifiedField: item.verifiedField,
      responseExcerpt: item.responseExcerpt,
      startIndex: item.startIndex,
      endIndex: item.endIndex
    })),
    ["Orders", "Refunds"].map((step) => {
      const startIndex = response.indexOf(step);

      return {
        claimType: "tracking_step",
        claimedValue: step,
        verifiedValue: step,
        verifiedField: "tracking_path",
        responseExcerpt: step,
        startIndex,
        endIndex: startIndex + step.length
      };
    })
  );
});

test("returns unknown when a bank-arrival timeframe has no verified payout estimate", () => {
  const result = evaluateRefundPromise(
    "Your refund is expected to reach your bank by the end of this week.",
    context
  );

  assert.equal(result.verdict, "unknown");
  assert.equal(result.passed, false);
});

test("accepts a bank-arrival date supported by a verified payout estimate", () => {
  const verifiedPayoutContext = {
    refund_status: "processing",
    refund_completed_at: null,
    payout_expected_at: "2026-11-13",
    payout_estimate_source: "Verified payment processor estimate",
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(
    "Your refund is expected to reach your bank on November 13, 2026.",
    verifiedPayoutContext
  );

  assert.equal(result.verdict, "pass");
  assert.equal(result.passed, true);
});

test("associates a bank-arrival date with a refund referenced in the previous sentence", () => {
  const response =
    "Your refund is still being processed. It is expected to reach your bank on November 20, 2026. Check Orders → Refunds.";

  const verifiedPayoutContext = {
    refund_status: "processing",
    refund_completed_at: null,
    payout_expected_at: "2026-11-20",
    payout_estimate_source: "Verified payment processor estimate",
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(response, verifiedPayoutContext);

  assert.equal(result.verdict, "pass");
  assert.equal(result.passed, true);
  assert.equal(result.evidence.length, 1);

  assert.equal(result.evidence[0].claimType, "payout_arrival_date");
  assert.equal(result.evidence[0].claimedValue, "2026-11-20");
  assert.equal(result.evidence[0].verifiedValue, "2026-11-20");
  assert.equal(
    result.evidence[0].verifiedField,
    "payout_expected_at"
  );
  assert.equal(
    result.evidence[0].verifiedSource,
    "Verified payment processor estimate"
  );

  const expectedExcerpt =
    "It is expected to reach your bank on November 20, 2026.";
  const expectedStart = response.indexOf(expectedExcerpt);

  assert.equal(result.evidence[0].responseExcerpt, expectedExcerpt);
  assert.equal(result.evidence[0].startIndex, expectedStart);
  assert.equal(
    result.evidence[0].endIndex,
    expectedStart + expectedExcerpt.length
  );
});

test("rejects conflicting refund arrival date claims in the same response", () => {
  const response =
    "Your refund will arrive on November 20, 2026. Your refund will arrive on November 25, 2026.";

  const verifiedPayoutContext = {
    refund_status: "processing",
    refund_completed_at: null,
    payout_expected_at: "2026-11-20",
    payout_estimate_source: "Verified payment processor estimate",
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(response, verifiedPayoutContext);

  assert.equal(result.verdict, "fail");
  assert.equal(result.passed, false);
  assert.equal(result.evidence.length, 2);

  assert.deepEqual(
    result.evidence.map((item) => item.claimedValue),
    ["2026-11-20", "2026-11-25"]
  );

  assert.ok(
    result.evidence.every(
      (item) => item.verifiedValue === "2026-11-20"
    )
  );
});

test("captures every arrival date when a refund is referenced as It", () => {
  const response =
    "Your refund is still processing. It will arrive on November 20, 2026, or November 25, 2026.";

  const verifiedPayoutContext = {
    refund_status: "processing",
    refund_completed_at: null,
    payout_expected_at: "2026-11-20",
    payout_estimate_source: "Verified payment processor estimate",
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(response, verifiedPayoutContext);

  assert.equal(result.verdict, "fail");
  assert.equal(result.passed, false);
  assert.equal(result.evidence.length, 2);

  assert.deepEqual(
    result.evidence.map((item) => item.claimedValue),
    ["2026-11-20", "2026-11-25"]
  );

  assert.ok(
    result.evidence.every(
      (item) => item.verifiedValue === "2026-11-20"
    )
  );
});

test("does not treat an unrelated coordinated date as another refund arrival claim", () => {
  const response =
    "Your refund will arrive on November 20, 2026, and our support team will contact you on November 25, 2026.";

  const verifiedPayoutContext = {
    refund_status: "processing",
    refund_completed_at: null,
    payout_expected_at: "2026-11-20",
    payout_estimate_source: "Verified payment processor estimate",
    tracking_path: "Orders → Refunds"
  };

  const result = evaluateRefundPromise(response, verifiedPayoutContext);

  assert.equal(result.verdict, "pass");
  assert.equal(result.passed, true);
  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0].claimedValue, "2026-11-20");
  assert.equal(result.evidence[0].verifiedValue, "2026-11-20");
});
