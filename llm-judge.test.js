
import test from "node:test";
import assert from "node:assert/strict";

import { evaluateWithLLM } from "./llm-judge.js";

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

const validResult = {
  refund_promise: {
    verdict: "pass",
    reason: "No unsupported arrival promise is made.",
    response_evidence: null,
    context_evidence: null
  },
  tracking_instruction: {
    verdict: "pass",
    reason: "The verified tracking path is provided.",
    response_evidence: "Orders → Refunds",
    context_evidence: "Orders → Refunds"
  },
  refund_status: {
    verdict: "pass",
    reason: "The response accurately describes the processing status.",
    response_evidence: "Your refund is being processed.",
    context_evidence: "refund_status: processing"
  }
};

function createMockClient(response) {
  return {
    responses: {
      create: async () => response
    }
  };
}

function createResponse(result) {
  return {
    status: "completed",
    output: [],
    output_text: JSON.stringify(result)
  };
}

test("returns a valid structured judge result", async () => {
  const client = createMockClient(createResponse(validResult));

  const result = await evaluateWithLLM(validInput, {
    client,
    model: "mock-model"
  });

  assert.deepEqual(result, validResult);
});

test("rejects an incomplete API response", async () => {
  const client = createMockClient({
    status: "incomplete",
    incomplete_details: {
      reason: "max_output_tokens"
    }
  });

  await assert.rejects(
    () => evaluateWithLLM(validInput, {
      client,
      model: "mock-model"
    }),
    /response incomplete/
  );
});

test("rejects a non-completed API response", async () => {
  const client = createMockClient({
    status: "failed",
    output: [],
    output_text: ""
  });

  await assert.rejects(
    () => evaluateWithLLM(validInput, {
      client,
      model: "mock-model"
    }),
    /did not complete successfully/
  );
});

test("rejects an LLM refusal", async () => {
  const client = createMockClient({
    status: "completed",
    output: [
      {
        content: [
          {
            type: "refusal",
            refusal: "I cannot complete this evaluation."
          }
        ]
      }
    ],
    output_text: ""
  });

  await assert.rejects(
    () => evaluateWithLLM(validInput, {
      client,
      model: "mock-model"
    }),
    /refused to evaluate/
  );
});

test("rejects empty structured output", async () => {
  const client = createMockClient({
    status: "completed",
    output: [],
    output_text: ""
  });

  await assert.rejects(
    () => evaluateWithLLM(validInput, {
      client,
      model: "mock-model"
    }),
    /no structured output/
  );
});

test("rejects invalid JSON output", async () => {
  const client = createMockClient({
    status: "completed",
    output: [],
    output_text: "{invalid json}"
  });

  await assert.rejects(
    () => evaluateWithLLM(validInput, {
      client,
      model: "mock-model"
    }),
    /invalid JSON/
  );
});

test("rejects output that violates the schema", async () => {
  const invalidResult = structuredClone(validResult);
  invalidResult.refund_status.verdict = "maybe";

  const client = createMockClient(createResponse(invalidResult));

  await assert.rejects(
    () => evaluateWithLLM(validInput, {
      client,
      model: "mock-model"
    }),
    /failed schema validation/
  );
});

test("rejects invalid input before calling the API", async () => {
  let apiCalled = false;

  const client = {
    responses: {
      create: async () => {
        apiCalled = true;
        return createResponse(validResult);
      }
    }
  };

  await assert.rejects(
    () => evaluateWithLLM({
      ...validInput,
      context: null
    }, {
      client,
      model: "mock-model"
    }),
    /Verified refund context/
  );

  assert.equal(apiCalled, false);
});

test("rejects a missing API key before creating the client", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_JUDGE_MODEL;

  delete process.env.OPENAI_API_KEY;
  process.env.OPENAI_JUDGE_MODEL = "mock-model";

  try {
    await assert.rejects(
      () => evaluateWithLLM(validInput),
      /OPENAI_API_KEY is not configured/
    );
  } finally {
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }

    if (originalModel === undefined) {
      delete process.env.OPENAI_JUDGE_MODEL;
    } else {
      process.env.OPENAI_JUDGE_MODEL = originalModel;
    }
  }
});

test("rejects an API error instead of converting it to unknown", async () => {
  const client = {
    responses: {
      create: async () => {
        throw new Error("Simulated API failure");
      }
    }
  };

  await assert.rejects(
    () => evaluateWithLLM(validInput, {
      client,
      model: "mock-model"
    }),
    /Simulated API failure/
  );
});

test("returns token usage separately from structured verdicts", async () => {
  const response = {
    ...createResponse(validResult),
    usage: {
      input_tokens: 250,
      output_tokens: 120,
      total_tokens: 370
    }
  };

  const client = createMockClient(response);

  const result = await evaluateWithLLM(validInput, {
    client,
    model: "mock-model"
  });

  assert.deepEqual(result.usage, {
    input_tokens: 250,
    output_tokens: 120,
    total_tokens: 370
  });

  assert.deepEqual(Object.keys(result), Object.keys(validResult));
  assert.deepEqual(
    {
      refund_promise: result.refund_promise,
      tracking_instruction: result.tracking_instruction,
      refund_status: result.refund_status
    },
    validResult
  );
});
