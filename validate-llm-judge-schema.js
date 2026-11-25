import Ajv2020 from "ajv/dist/2020.js";
import fs from "node:fs";

const schemaPath = "./schemas/llm-judge-output.schema.json";

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

const ajv = new Ajv2020({ strict: true });

try {
  ajv.compile(schema);
  console.log("LLM JUDGE SCHEMA VALID");
} catch (error) {
  console.error("LLM JUDGE SCHEMA INVALID");
  console.error(error.message);
  process.exitCode = 1;
}