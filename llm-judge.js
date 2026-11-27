import OpenAI from "openai";
import Ajv2020 from "ajv/dist/2020.js";
import fs from "node:fs";

import { prepareJudgeInput } from "./llm-judge-input.js";

const prompt = fs.readFileSync(
  new URL("./prompts/llm-judge-v1.md", import.meta.url),
  "utf8"
);

const schema = JSON.parse(
  fs.readFileSync(
    new URL("./schemas/llm-judge-output.schema.json", import.meta.url),
    "utf8"
  )
);

const ajv = new Ajv2020({ strict: true });
const validate = ajv.compile(schema);


function validateEvidence(result, preparedInput) {
  for (const [dimension, evaluation] of Object.entries(result)) {
    if (
      evaluation.response_evidence !== null &&
      !preparedInput.candidate_response.includes(evaluation.response_evidence)
    ) {
      throw new Error(
        `LLM judge returned unverified response evidence for ${dimension}.`
      );
    }

    if (evaluation.context_evidence !== null) {
      const verified = Object.entries(preparedInput.context).some(
        ([field, value]) =>
          typeof value === "string" &&
          (
            evaluation.context_evidence === value ||
            evaluation.context_evidence === `${field}: ${value}`
          )
      );

      if (!verified) {
        throw new Error(
          `LLM judge returned unverified context evidence for ${dimension}.`
        );
      }
    }
  }
}
export async function evaluateWithLLM(input, options = {}) {
  const preparedInput = prepareJudgeInput(input);

  if (!options.client && !process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = options.model ?? process.env.OPENAI_JUDGE_MODEL;

  if (!model) {
    throw new Error("OPENAI_JUDGE_MODEL is not configured.");
  }


  const requestOptions = {};

  if (options.timeoutMs !== undefined) {
    if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
      throw new Error("timeoutMs must be a positive finite number.");
    }

    requestOptions.timeout = options.timeoutMs;
  }

  if (options.signal !== undefined) {
    requestOptions.signal = options.signal;
  }

  const client = options.client ?? new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const response = await client.responses.create({
    model,
    instructions: prompt,
    input: JSON.stringify(preparedInput),
    text: {
      format: {
        type: "json_schema",
        name: "customer_support_judge_result",
        strict: true,
        schema
      }
    }
  }, requestOptions);

  if (response.status === "incomplete") {
    throw new Error(
      `LLM judge response incomplete: ${response.incomplete_details?.reason ?? "unknown reason"}`
    );
  }

  if (response.status !== "completed") {
    throw new Error(
      `LLM judge did not complete successfully: ${response.status}`
    );
  }

  if (response.output?.some((item) =>
    item.content?.some((content) => content.type === "refusal")
  )) {
    throw new Error("LLM judge refused to evaluate the response.");
  }

  if (
    typeof response.output_text !== "string" ||
    response.output_text.trim() === ""
  ) {
    throw new Error("LLM judge returned no structured output.");
  }

  let result;

  try {
    result = JSON.parse(response.output_text);
  } catch {
    throw new Error("LLM judge returned invalid JSON.");
  }

  if (!validate(result)) {
    throw new Error(
      `LLM judge output failed schema validation: ${ajv.errorsText(validate.errors)}`
    );
  }

  validateEvidence(result, preparedInput);

  Object.defineProperty(result, "usage", {
    value: response.usage,
    enumerable: false
  });

  return result;
}
