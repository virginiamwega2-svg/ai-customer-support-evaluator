# AI Customer Support Response Evaluator

An AI customer-support response evaluation project combining deterministic rule-based checks with an optional LLM-as-a-Judge evaluator. Both approaches assess AI-generated responses against verified business context across three evaluation dimensions.

The project focuses on identifying unsupported refund promises, incorrect tracking instructions, and contradictions between an AI response and a customer's verified refund status.

## Why this project exists

AI-generated customer-support responses can sound convincing while providing inaccurate information.

For example, an AI assistant might promise that a refund will arrive within 48 hours even though the business has not confirmed a payout date.

This project demonstrates how structured evaluation can help identify specific customer-support errors, preserve evidence for decisions, and distinguish between confirmed errors and situations where the available evidence is insufficient.

## Evaluation dimensions

The project evaluates three dimensions:

### 1. Refund promise accuracy

Checks whether a response:

- Promises an unconfirmed refund arrival date.
- Gives an unsupported timeframe, such as "within 48 hours".
- Provides an unsupported weekday.
- Gives a refund completion or arrival date that conflicts with verified information.
- Contains an impossible calendar date connected to a refund claim.

Refund completion dates and bank payout arrival dates are treated as separate pieces of information. A confirmed completion date does not, by itself, verify when money will arrive in a customer's bank account.

### 2. Tracking instruction accuracy

Checks whether the response includes the verified refund tracking path in the correct order.

Example:

`Orders → Refunds`

### 3. Refund status consistency

Checks whether a response contradicts the verified refund status.

Supported statuses:

- `processing`
- `completed`
- `failed`

For example, a response describing a processing refund as completed should fail the status check.

## Evaluation verdicts

Each evaluation dimension returns one of three verdicts:

- `pass`: the response is supported by the verified business context.
- `fail`: the response contains an identified contradiction or unsupported claim.
- `unknown`: the evaluation completed, but the available evidence is insufficient for a definitive decision.

An `unknown` verdict is an intentional abstention. It is different from an evaluation error: an API failure or invalid output means the evaluation did not complete successfully.

## Project structure

```text
ai-customer-support-evaluator/
├── .env.example
├── .gitignore
├── benchmark.js
├── customer-support-dataset.json
├── customer-support-heldout.json
├── customer-support-evaluator.js
├── customer-support-evaluator.test.js
├── llm-benchmark.js
├── llm-judge.js
├── llm-judge.test.js
├── llm-judge-input.js
├── llm-judge-input.test.js
├── llm-judge-schema.test.js
├── validate-llm-judge-schema.js
├── prompts/
│   └── llm-judge-v1.md
├── schemas/
│   └── llm-judge-output.schema.json
├── package.json
├── package-lock.json
└── README.md
```

## Requirements

- Node.js 22 or later
- npm

The project uses:

- **OpenAI SDK:** communicates with the OpenAI Responses API for optional LLM-as-a-Judge evaluation.
- **AJV:** validates structured LLM judge output against a JSON Schema.

Install the dependencies using `npm install`.

## Getting started

Clone the repository:

```bash
git clone YOUR_REPOSITORY_URL
cd ai-customer-support-evaluator
```

Install dependencies:

```bash
npm install
```

Run the automated tests:

```bash
npm test
```

The deterministic evaluator and its benchmark can be used without configuring an OpenAI API key.

## Evaluation datasets

The project uses two separate datasets:

- **Development dataset:** 6 scenarios containing 20 candidate responses.
- **Held-out dataset:** 3 separate scenarios containing 3 candidate responses.

The held-out examples are kept separate from the development dataset to provide an additional check against examples not used during evaluator development.

Each candidate response has an expected verdict for all three evaluation dimensions.

The expected labels are used by the benchmark to measure agreement with the evaluator's decisions. They are not supplied to the LLM judge during evaluation.

## Automated testing

The current test suite contains **154 automated tests**.

Coverage includes:

- Supported and unsupported refund timeframes.
- Confirmed and conflicting completion and payout dates.
- Invalid and impossible calendar dates.
- Correct and incorrect tracking paths.
- Refund status contradictions and negated claims.
- Evidence extraction and traceability.
- Dataset-driven scenario evaluation.
- LLM judge input validation.
- Strict structured output schema validation.
- API refusal, incomplete response and error handling.
- Separation of token usage metadata from structured verdicts.

Run the test suite:

```bash
npm test
```

## Benchmarking and measurement

### Deterministic evaluator

Run the development benchmark:

```bash
npm run benchmark
```

Run the separate held-out evaluation:

```bash
node benchmark.js --heldout
```

The benchmark reports:

- Three-way exact verdict accuracy.
- Binary confusion matrices, precision, recall, F1 and accuracy.
- Coverage and abstention rate.
- Correct, unnecessary and missed abstentions.
- Results for each evaluation dimension.

Binary classification metrics are calculated only for cases where both the expected and actual verdicts are definitive (`pass` or `fail`). `unknown` is treated as an abstention, not as a binary class.

Coverage measures the proportion of responses receiving a definitive verdict. Abstention rate measures the proportion receiving `unknown`.

### Current deterministic benchmark results

The current development dataset produces 60 matching verdicts across 60 dimension-level evaluations.

The held-out dataset produces 9 matching verdicts across 9 dimension-level evaluations.

No verdict disagreements were observed in either dataset.

These results demonstrate agreement on the evaluated examples. They do not establish real-world accuracy, production readiness or broad generalisation. The held-out dataset is particularly small.

## Technical approach

The deterministic evaluator uses JavaScript rules and regular-expression-based checks against supplied verified business context.

The three main evaluation functions are:

- `evaluateRefundPromise(response, context)`
- `evaluateTrackingInstruction(response, context)`
- `evaluateRefundStatus(response, context)`

Each dimension returns a structured result with a verdict and an explanation. Evidence records support traceability for relevant decisions.

The benchmark compares actual verdicts with expected dataset labels and reports results separately for each dimension.

## LLM-as-a-Judge evaluation

The project also includes an optional LLM-as-a-Judge evaluator using the OpenAI Responses API.

The LLM judge independently evaluates the same three dimensions as the deterministic evaluator.

The two approaches have different responsibilities:

- **Deterministic evaluator:** applies explicit rules to verifiable claims, dates, tracking paths and refund status.
- **LLM judge:** interprets language and context, including paraphrased claims, and provides structured reasoning and supporting evidence.

The LLM judge receives only:

- Customer message.
- Verified business context.
- Candidate response.

It does not receive expected dataset labels, reference answers or scenario-specific expected behaviour. This helps prevent benchmark-label leakage into its decisions.

### Structured output

The LLM judge returns a strict JSON object containing:

- A `pass`, `fail` or `unknown` verdict for each dimension.
- A concise explanation for each verdict.
- Supporting response evidence and verified context evidence where available.

The output is validated against:

`schemas/llm-judge-output.schema.json`

AJV is used for schema validation. The versioned evaluation instructions are maintained in:

`prompts/llm-judge-v1.md`

The schema enforces the expected structure and allowed verdicts. It does not independently prove that the model's reasoning or evidence is factually correct.

API failures, incomplete responses, refusals and invalid outputs are treated as evaluation errors, not as `unknown` verdicts.

### LLM judge configuration

The optional LLM judge requires an OpenAI API key and a model name.

Copy `.env.example` to `.env` and configure:

```text
OPENAI_API_KEY=your_api_key
OPENAI_JUDGE_MODEL=your_model_name
```

Keep `.env` private. It is excluded from version control.

### Running the LLM benchmark

Live evaluation requires an available OpenAI API balance and explicit approval through the `--live` flag.

Evaluate one development response:

```bash
npm run llm-benchmark -- --live --limit 1
```

Evaluate the held-out dataset:

```bash
npm run llm-benchmark -- --live --heldout
```

The `--limit` option restricts the number of candidate responses evaluated.

The benchmark measures:

- Exact agreement with expected verdicts.
- Disagreements for each evaluation dimension.
- Total and average evaluation latency.
- Input, output and total token usage when available.

The live-evaluation guard prevents accidental API usage when the `--live` flag is omitted. Invalid command-line arguments and limits are rejected before evaluation begins.

### Current LLM evaluation status

The LLM judge integration, structured output validation and mocked API tests are implemented.

Live model evaluation has not yet been completed because API credits were unavailable during development.

Mocked tests verify input handling, output structure, token usage handling and API failure behaviour. They do not establish the model's actual evaluation quality.

No live LLM accuracy, agreement or reliability results are currently claimed.

## Limitations

This project is an evaluation prototype, not a production customer-support system.

- The deterministic evaluator relies on predefined text patterns and rules rather than broad semantic language understanding.
- It may not recognize every possible wording or interpretation of a customer-support response.
- The project does not currently evaluate empathy, tone, completeness or overall helpfulness.
- It does not connect to live refund, payment or tracking systems.
- The development dataset contains only 6 scenarios and 20 candidate responses.
- The held-out dataset contains only 3 scenarios and 3 candidate responses. This is too small to establish broad generalisation.
- The scenarios and expected verdicts are manually constructed; benchmark results depend on the quality of those labels and the supplied business context.
- The deterministic benchmark results are not evidence of production performance or real-world customer outcomes.
- The LLM judge has not yet undergone live model evaluation or independent human-reviewed quality assessment.
- Structured output validation does not guarantee factual correctness or sound reasoning.
- The project does not yet include a dashboard or historical evaluation interface.

These limitations define areas for further reliability, measurement and usability work.

## Future improvements

Potential next steps include:

- Expanding the development and held-out datasets with more realistic customer-support scenarios.
- Completing live LLM judge evaluation when API access is available.
- Comparing deterministic and LLM judge disagreements through evidence-based review.
- Introducing human-reviewed assessments to evaluate judge reliability.
- Measuring model consistency, latency and cost across repeated evaluations.
- Strengthening reliability, privacy and failure-handling tests.
- Building an evaluation dashboard for metrics, scenario exploration and evidence inspection.
- Improving setup instructions, examples and developer documentation.

## License

License not yet specified.