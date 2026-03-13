# Mission Execution Coordination Operations

## List and Inspect Bridge Plans

- `npm run mission-control:execution-list`
- `npm run mission-control:execution-inspect -- --plan <planId>`

Use inspect output to verify the deterministic bridge between orchestration actions and execution-side request semantics.

## Inspect Intents and Requests

- `npm run mission-control:execution-intents -- --plan <planId>`
- `npm run mission-control:execution-requests -- --plan <planId>`
- `npm run mission-control:execution-feedback -- --plan <planId>`

Interpretation guidance:
- intents describe purpose (`monitoring`, `review`, `reassessment`, `stabilization` semantics)
- requests describe bridge dispatch intent only (not runtime execution)
- feedback links may contain partial IDs; partial linkage is valid and deterministic

## Inspect Status and Outcome

- `npm run mission-control:execution-status -- --plan <planId>`
- `npm run mission-control:execution-history -- --plan <planId>`

Status expresses bridge posture:
- `not_started`, `pending_execution`, `execution_active`, `execution_completed`, `execution_failed`, `execution_deferred`, `inconclusive`

Outcome expresses interpreted progress:
- `pending`, `active`, `partially_completed`, `completed`, `failed`, `deferred`, `inconclusive`

When uncertain, prefer `pending_execution`, `execution_deferred`, `inconclusive`, or `partially_completed` over false completion.

## Materialize Artifacts

- `npm run mission-control:execution-materialize -- --plan <planId>`

Artifacts are written under:
- `artifacts/mission-control/execution/<planId>/`

Files:
- `mission-execution-coordination-status.json`
- `mission-execution-intents.json`
- `mission-execution-requests.json`
- `mission-execution-feedback-links.json`
- `mission-execution-coordination-history.json`
- `mission-execution-coordination-outcome.json`
- `mission-execution-coordination-report.json`
- `mission-execution-coordination-report.md`

## Bounded Bridge Actions

These commands append bridge-state events only:
- `npm run mission-control:execution-defer -- --plan <planId> [--reason <csv>]`
- `npm run mission-control:execution-mark-active -- --plan <planId> [--reason <csv>]`
- `npm run mission-control:execution-mark-complete -- --plan <planId> [--reason <csv>]`

They do not trigger worker execution or mutate runtime layers.
