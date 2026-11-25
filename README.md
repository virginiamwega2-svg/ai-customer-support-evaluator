# AI Customer Support Response Evaluator

A deterministic evaluation tool for checking AI-generated customer-support responses against verified business context.

This project focuses on identifying unsupported refund promises, incorrect tracking instructions, and contradictions between an AI response and a customer's verified refund status.

## Why this project exists

AI-generated customer-support responses can sound convincing while providing inaccurate information.

For example, an AI assistant might promise that a refund will arrive within 48 hours even though the business has not confirmed a completion date.

This evaluator demonstrates how deterministic checks can identify specific, verifiable customer-support errors before responses are accepted.

## Evaluation dimensions

The evaluator currently implements three checks:

### 1. Unsupported refund promises

Checks whether a response:

- Promises an unconfirmed refund arrival date.
- Gives an unsupported timeframe, such as "within 48 hours".
- Provides an unsupported weekday.
- Gives a refund completion or arrival date that conflicts with verified information.
- Contains an impossible calendar date connected to a refund claim.

### 2. Verified tracking instructions

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

## Project structure

```text
ai-customer-support-evaluator/
├── .gitignore
├── customer-support-dataset.json
├── customer-support-heldout.json
├── customer-support-evaluator.js
├── customer-support-evaluator.test.js
├── benchmark.js
├── package.json
└── README.md
```

## Requirements

- Node.js 22 or later
- npm

No external npm dependencies are required.

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

## Evaluation dataset

The project uses two separate datasets:

- **Development dataset:** 6 scenarios containing 20 candidate responses.
- **Held-out dataset:** 3 separate scenarios containing 3 candidate responses.

The held-out examples are kept separate from the development dataset to provide an additional check against examples not used during evaluator development.

Each response has an expected verdict for three evaluation dimensions:

- Refund promise accuracy
- Tracking instruction accuracy
- Refund status consistency

The evaluator uses three verdicts:

- `pass`: the response is supported by the verified business context.
- `fail`: the response contains an identified contradiction or unsupported claim.
- `unknown`: the available evidence is insufficient for a definitive decision.

## Current test coverage

The current test suite contains **127 automated tests**.

Coverage includes:

- Supported and unsupported refund timeframes.
- Confirmed and conflicting completion dates.
- Invalid and impossible calendar dates.
- Correct and incorrect tracking paths.
- Refund status contradictions.
- Negated status claims.
- Evidence extraction and traceability.
- Dataset-driven scenario evaluation.

Run the test suite:

```bash
npm test
```

## Benchmarking and measurement

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

### Current benchmark results

The current development dataset produces 60 matching verdicts across 60 dimension-level evaluations.

The held-out dataset produces 9 matching verdicts across 9 dimension-level evaluations.

No verdict disagreements were observed in either dataset.

These results demonstrate agreement on the evaluated examples, not proven real-world accuracy or broad generalisation.

## Technical approach

The evaluator uses deterministic JavaScript rules and regular-expression-based checks against supplied verified business context.

The three main evaluation functions are:

- `evaluateRefundPromise(response, context)`
- `evaluateTrackingInstruction(response, context)`
- `evaluateRefundStatus(response, context)`

Each dimension returns a structured result with a verdict and an explanation. Evidence records support traceability for relevant decisions.

The benchmark compares actual verdicts with expected dataset labels and reports results separately for each dimension.

## Limitations

This is a deterministic evaluation implementation, not a general-purpose semantic evaluator or a production customer-support system.

- It relies on predefined text patterns and rules rather than broad semantic language understanding.
- It may not recognize every possible wording or interpretation of a customer-support response.
- It does not currently evaluate empathy, tone, completeness or overall helpfulness.
- It does not connect to live refund, payment or tracking systems.
- The development dataset contains only 6 scenarios and 20 candidate responses.
- The held-out dataset contains only 3 scenarios and 3 candidate responses. This is too small to establish broad generalisation.
- The scenarios and expected verdicts are manually constructed; benchmark results depend on the quality of those labels and the supplied business context.
- The current benchmark results are not evidence of production performance or real-world customer outcomes.
- No LLM-as-judge evaluation is currently integrated.

These limitations define areas for further evaluation and reliability work.

## Future improvements

Potential next steps include:

- Expanding the evaluation dataset with more realistic customer-support scenarios.
- Adding additional evaluation dimensions, such as empathy, completeness and clarity.
- Introducing structured evaluation reports and a dashboard.
- Integrating an LLM-as-a-Judge evaluation approach for qualitative response assessment.
- Comparing deterministic evaluation results against model-based and human-reviewed assessments.
- Measuring evaluator reliability, latency and cost.

## License

License not yet specified.