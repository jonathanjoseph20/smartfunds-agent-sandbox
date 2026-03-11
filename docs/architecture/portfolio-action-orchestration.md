# Portfolio Action Orchestration

## Purpose

Portfolio Action Orchestration is the deterministic coordination layer between portfolio action routing and any future execution systems.

It does not execute actions, allocate capital, or trigger external systems.

## Model

Input:
- portfolio action candidates from `control-plane/portfolio-actions`

Output:
- action plans grouped from candidates
- deterministic readiness, blockers, completion, priority, and route summary
- inspectable artifacts under `artifacts/action-orchestration/<planId>/`

## Flow

1. Load action plan definitions from `control-plane/action-orchestration/definitions`.
2. Link action candidates into plans using explicit matching rules.
3. Evaluate readiness and blockers conservatively.
4. Evaluate completion as intelligence stabilization only.
5. Evaluate priority and route summary from linked candidates.
6. Project deterministic outputs.
7. Materialize status/history/report artifacts on demand.

## Determinism Rules

- No timestamps, randomness, or UUID generation.
- Canonical JSON persistence with sorted arrays.
- Stable ordering by `actionPlanId` and linked entity IDs.
- History dedupe via deterministic hash of event payload.

## Linking Semantics

Linking is explainable and explicit only.

Current rationale token families:
- `explicit_definition_match:<token>`
- `matching_route_category:<route>`
- `shared_risk_theme:<theme>`

No fuzzy matching, LLM scoring, or semantic inference is used.

## Readiness and Completion

Readiness states:
- `pending`
- `analyzing`
- `coherent`
- `blocked`

Completion states:
- `completed`
- `incomplete`
- `inconclusive`

`completed` means the intelligence object is stabilized, not that any real-world portfolio action executed.

## Projection vs Materialization

Projection is source of truth:
- `action-plan-projection.ts`
- no persistence side effects

Materialization is persistence only:
- writes `action-plan-status.json`
- writes `action-plan-history.json`
- writes `action-plan-report.json`
- writes `action-plan-report.md`

Materialization must not mutate readiness/lifecycle/completion/priority semantics.

## CLI Surface

- `action-orchestration:list`
- `action-orchestration:inspect -- --plan <id>`
- `action-orchestration:status -- --plan <id>`
- `action-orchestration:links -- --plan <id>`
- `action-orchestration:readiness -- --plan <id>`
- `action-orchestration:priority -- --plan <id>`
- `action-orchestration:history -- --plan <id>`
- `action-orchestration:materialize -- --plan <id>`

All command responses are canonical JSON with stable `{ "error": "..." }` error payloads.
