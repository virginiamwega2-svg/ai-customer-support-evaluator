# AI Customer Support Response Evaluator

An AI customer-support response evaluation project combining deterministic rule-based checks with an optional LLM-as-a-Judge evaluator.

The system evaluates AI-generated customer-support responses against verified business context across three dimensions:

1. Refund promise accuracy
2. Tracking instruction accuracy
3. Refund status consistency

The project focuses on identifying unsupported refund promises, incorrect tracking instructions, and contradictions between an AI-generated response and a customer's verified refund status.

It demonstrates how evaluation systems can combine deterministic checks, structured LLM judgments, evidence traceability, measurement, and reliability safeguards.

## Why this project exists

AI-generated customer-support responses can sound convincing while providing inaccurate information.

For example, an AI assistant might promise that a refund will arrive within 48 hours even though the business has not confirmed a payout date.

This project explores how structured evaluation can identify these errors, preserve supporting evidence, and distinguish between confirmed problems and situations where the available information is insufficient.

## Evaluation dimensions

### 1. Refund promise accuracy

Checks whether a response:

- Promises an unconfirmed refund arrival date.
- Gives an unsupported timeframe, such as "within 48 hours".
- Provides an unsupported weekday.
- Gives a refund completion or arrival date that conflicts with verified information.
- Contains an impossible calendar date connected to a refund claim.

Refund completion dates and bank payout arrival dates are treated as separate pieces of information. A confirmed refund completion date does not, by itself, establish when money will arrive in a customer's bank account.

### 2. Tracking instruction accuracy

Checks whether a response includes the verified refund tracking path in the correct order.

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

| Verdict | Meaning |
|---|---|
| `pass` | The response is supported by the verified business context. |
| `fail` | The response contains an identified contradiction or unsupported claim. |
| `unknown` | Evaluation completed, but the available evidence is insufficient for a definitive decision. |

An `unknown` verdict is an intentional abstention. It is not the same as an evaluation error.

An API failure, refusal, incomplete response, or invalid output means the evaluation did not complete successfully. Such failures are handled separately rather than being silently converted into `unknown`.

## Project structure

```text
ai-customer-support-evaluator/
├── .env.example
├── .gitignore
├── benchmark.js
├── benchmark-errors.js
├── customer-support-dataset.json
├── customer-support-heldout.json
├── customer-support-evaluator.js
├── customer-support-evaluator.test.js
├── dataset-validation.js
├── dataset-validation.test.js
├── llm-benchmark.js
├── llm-benchmark.test.js
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

The deterministic evaluator and its benchmark can run without an OpenAI API key.

## Evaluation datasets

The project uses two separate datasets.

| Dataset | Scenarios | Candidate responses |
|---|---:|---:|
| Development | 6 | 20 |
| Held-out | 3 | 3 |

The held-out examples are kept separate from the development dataset to provide an additional check against examples not used during evaluator development.

Each candidate response has an expected verdict for all three evaluation dimensions.

The expected labels are used by the benchmark to measure agreement with evaluator decisions. They are not supplied to the LLM judge during evaluation.

### Dataset validation

Both deterministic and LLM benchmark workflows validate their input datasets before evaluation.

Validation checks include:

- Non-empty datasets and response collections.
- Required scenario and response fields.
- Valid refund statuses and calendar dates.
- Valid expected verdicts.
- Unique scenario identifiers.
- Unique response identifiers within each scenario.

Invalid dataset structures are rejected before benchmark evaluation proceeds.

## Automated testing

The current test suite contains **178 automated tests**.

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
- API refusal, incomplete response, and error handling.
- Separation of token usage metadata from structured verdicts.
- Dataset structure, required fields, and identifier validation.
- Exact verification of LLM response and context evidence quotations.
- Request timeout and cancellation handling.
- Live benchmark CLI safeguards and response limits.
- Sanitization of API errors to avoid exposing sensitive details.

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
- Binary confusion matrices.
- Precision, recall, F1, and accuracy.
- Coverage and abstention rate.
- Correct, unnecessary, and missed abstentions.
- Results for each evaluation dimension.

Binary classification metrics are calculated only when both expected and actual verdicts are definitive (`pass` or `fail`).

An `unknown` verdict is treated as an abstention, not as a binary classification.

Coverage measures the proportion of responses receiving a definitive verdict. Abstention rate measures the proportion receiving `unknown`.

### Current deterministic benchmark results

The current development dataset produces:

- 60 matching verdicts across 60 dimension-level evaluations.
- No observed verdict disagreements.

The held-out dataset produces:

- 9 matching verdicts across 9 dimension-level evaluations.
- No observed verdict disagreements.

Development dataset coverage and abstention:

| Dimension | Exact accuracy | Coverage | Abstention |
|---|---:|---:|---:|
| Refund promise | 100% | 65% | 35% |
| Tracking instructions | 100% | 100% | 0% |
| Refund status | 100% | 85% | 15% |

These results demonstrate agreement on the evaluated examples. They do not establish real-world accuracy, production readiness, or broad generalisation.

The held-out dataset is particularly small, so its results should be interpreted cautiously.

## Technical approach

### Deterministic evaluation

The deterministic evaluator uses JavaScript rules and regular-expression-based checks against supplied verified business context.

The three main evaluation functions are:

```javascript
evaluateRefundPromise(response, context)
evaluateTrackingInstruction(response, context)
evaluateRefundStatus(response, context)
```

Each function returns a structured result containing a verdict and an explanation. Evidence records support traceability for relevant decisions.

The benchmark compares actual verdicts with expected dataset labels and reports results separately for each evaluation dimension.

### LLM-as-a-Judge evaluation

The project also includes an optional LLM-as-a-Judge evaluator using the OpenAI Responses API.

The LLM judge independently evaluates the same three dimensions as the deterministic evaluator.

The two approaches have different responsibilities:

| Evaluator | Responsibility |
|---|---|
| Deterministic evaluator | Applies explicit rules to verifiable claims, dates, tracking paths, and refund status. |
| LLM judge | Interprets language and context, including paraphrased claims, and provides structured reasoning and supporting evidence. |

The LLM judge receives only:

- Customer message.
- Verified business context.
- Candidate response.

It does not receive expected dataset labels, reference answers, or scenario-specific expected behaviour. This helps prevent benchmark-label leakage into its decisions.

The two evaluators retain separate verdicts. An LLM judgment does not silently replace a deterministic result.

### Structured output

The LLM judge returns a strict JSON object containing:

- A `pass`, `fail`, or `unknown` verdict for each dimension.
- A concise explanation for each verdict.
- Supporting response evidence and verified context evidence where available.

The output is validated against:

`schemas/llm-judge-output.schema.json`

AJV is used for schema validation.

The versioned evaluation instructions are maintained in:

`prompts/llm-judge-v1.md`

The schema enforces the expected structure and allowed verdicts. It does not independently prove that the model's reasoning or evidence is factually correct.

### Evidence integrity

The LLM judge's evidence quotations are checked against the supplied input.

- Response evidence must be an exact substring of the candidate response.
- Context evidence must match a supplied context value or its corresponding field