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

├── customer-support-evaluator.js

├── customer-support-evaluator.test.js

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



Run the automated tests:



```bash

npm test

```



## Evaluation dataset



The project includes three refund scenarios:



| Scenario | Description |

|---|---|

| REF-001 | Refund is processing |

| REF-002 | Refund is completed |

| REF-003 | Refund has failed |



Each scenario contains verified business context, expected behavior, a reference answer, and multiple candidate AI responses.



The automated tests evaluate each candidate against three dimensions:



- Refund promise accuracy

- Tracking instruction accuracy

- Refund status consistency



## Current test coverage



The current test suite contains **77 automated tests**, covering:



- Supported and unsupported refund timeframes.

- Confirmed and conflicting completion dates.

- Invalid and impossible calendar dates.

- Correct and incorrect tracking paths.

- Refund status contradictions.

- Negated status claims.

- Dataset-driven scenario evaluation.



Run `npm test` to execute the suite.



## Technical approach



The evaluator uses JavaScript functions and regular-expression-based rules to compare AI-generated responses against verified context.



The three main functions are:



- `evaluateRefundPromise(response, context)`

- `evaluateTrackingInstruction(response, context)`

- `evaluateRefundStatus(response, context)`



Each function returns a structured result containing:



- The evaluation check name.

- A boolean `passed` value.

- A human-readable explanation.



## Limitations



This is an early deterministic evaluation implementation.



- It relies on predefined text patterns rather than semantic language understanding.

- It may not recognize every possible wording of a customer-support response.

- It does not evaluate empathy, tone, completeness or overall helpfulness.

- It does not connect to a live refund or payment system.

- Its results depend on the accuracy of the supplied verified business context.



These limitations are intentional areas for future evaluation improvements.



## Future improvements



Potential next steps include:



- Expanding the evaluation dataset with more realistic customer-support scenarios.

- Adding additional evaluation dimensions, such as empathy, completeness and clarity.

- Introducing structured evaluation reports.

- Exploring LLM-as-a-Judge evaluation for qualitative response assessment.

- Comparing automated evaluation results against human-reviewed examples.



## License



License not yet specified.





