# Mission Control Orchestration Operations

## Inspect Intervention Plans
Use:
- `npm run mission-control:orchestration-list`
- `npm run mission-control:orchestration-inspect -- --plan <plan-id>`

These commands provide the operator-inspectable intervention posture, strategy linkage, actions, queue, priority, and outcome.

## Read Stabilization Strategies
Use:
- `npm run mission-control:orchestration-strategies`

Each strategy shows deterministic reason tokens and linked dependencies/blocking/escalation patterns.

## Inspect Orchestration Actions and Queue
Use:
- `npm run mission-control:orchestration-actions -- --plan <plan-id>`
- `npm run mission-control:orchestration-queue`

Queue output is JSON-only and deterministically ordered.

## Inspect Priority and Outcome
Use:
- `npm run mission-control:orchestration-priority -- --plan <plan-id>`
- `npm run mission-control:orchestration-inspect -- --plan <plan-id>`

Priority is deterministic and derived from systemic posture inputs only.

## Inspect Orchestration History
Use:
- `npm run mission-control:orchestration-history -- --plan <plan-id>`

History is append-only and replay-safe.

## Materialize Orchestration Artifacts
Use:
- `npm run mission-control:orchestration-materialize -- --plan <plan-id>`

Artifacts are written to:
- `artifacts/mission-control/orchestration/<missionControlInterventionPlanId>/`

Artifact set:
- `mission-control-orchestration-status.json`
- `mission-control-intervention-plan.json`
- `mission-control-stabilization-strategy.json`
- `mission-control-orchestration-actions.json`
- `mission-control-orchestration-queue.json`
- `mission-control-orchestration-priority.json`
- `mission-control-orchestration-history.json`
- `mission-control-orchestration-report.json`
- `mission-control-orchestration-report.md`
