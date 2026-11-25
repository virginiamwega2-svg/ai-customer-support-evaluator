
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

export async function evaluateWithLLM(input, options = {}) {
  const preparedInput = prepareJudgeInput(input);

  if (!options.client && !process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = options.model ?? process.env.OPENAI_JUDGE_MODEL;

  if (!model) {
    throw new Error("OPENAI_JUDGE_MODEL is not configured.");
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
  });

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

  Object.defineProperty(result, "usage", {
    value: response.usage,
    enumerable: false
  });

  return result;
}
