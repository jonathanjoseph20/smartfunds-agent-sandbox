# Mission Execution Coordination

## Purpose

Mission Execution Coordination is the deterministic bridge between mission-control orchestration decisions and execution-layer request records.

It does not perform runtime execution, worker dispatch, or result mutation.

## Bridge Model

Input:
- mission-control orchestration projection (`intervention plan`, `action items`, `priority`, `state`)

Output:
- mission execution coordination plan
- orchestration-to-execution mappings
- execution intents
- execution request records
- execution feedback links
- coordination status and outcome
- append-only coordination history

## Orchestration to Execution Mapping

Seed mappings are explicit and deterministic:
- `maintain_watch_state` -> `monitoring_task_intent`
- `request_resolution_reassessment` -> `reassessment_intent`
- `request_portfolio_review` -> `review_request_intent`
- `stabilize_blocking_cluster` -> `blocking_cluster_followup_intent`

Unmapped action classes are intentionally ignored.

## Execution Intent Model

Execution intents represent semantic purpose only.

Each intent links to orchestration action item IDs and derives deterministic identity from:
- coordination plan ID
- intent class
- linked action IDs
- canonical reason tokens

## Execution Request Model

Execution requests represent control-plane request records only.

They include:
- intent linkage
- mapped request class
- target execution domain
- deterministic priority/state
- canonical reason tokens

## Feedback Link Model

Feedback links connect request records to execution-side identifiers (when present):
- executionAttemptId
- taskExecutionRunId
- workerResultId

Partial linkage is valid and replay-safe. Missing execution identifiers are represented as explicit `null` values.

## Determinism

- identities: `canonicalStringify(payload) -> sha256`
- no timestamps, random values, process IDs, or filesystem paths in identity payloads
- sorted arrays and stable map/set normalization
- append-only event history with deterministic dedupe keys
- replay derives the same projection for identical inputs

## Projection vs Materialization

Projection defines truth:
- computed from orchestration projection + coordination history + feedback links

Materialization persists truth:
- writes deterministic JSON and markdown report artifacts under:
  - `artifacts/mission-control/execution/<planId>/`

Materialization must not alter runtime semantics.

## CLI Surface

Inspection:
- `mission-control:execution-list`
- `mission-control:execution-inspect -- --plan <id>`
- `mission-control:execution-intents -- --plan <id>`
- `mission-control:execution-requests -- --plan <id>`
- `mission-control:execution-feedback -- --plan <id>`
- `mission-control:execution-status -- --plan <id>`
- `mission-control:execution-history -- --plan <id>`

Materialization:
- `mission-control:execution-materialize -- --plan <id>`

Bounded bridge actions:
- `mission-control:execution-defer -- --plan <id>`
- `mission-control:execution-mark-active -- --plan <id>`
- `mission-control:execution-mark-complete -- --plan <id>`

All command responses are JSON-only with stable `{ "error": "..." }` failures.
