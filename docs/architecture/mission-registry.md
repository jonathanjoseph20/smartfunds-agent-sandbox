# Mission Registry

## Purpose

The Mission Registry is the bounded pre-execution representation of founder-directed work in SmartFunds Agent OS.

Sprint 3.1 introduces deterministic mission objects that support:

- mission definition lookup
- mission instance identity and state
- append-only mission history
- projection for inspection and materialization

This layer does **not** execute teams, invoke workflows, or perform autonomous routing.

## Definition vs Instance

- `MissionDefinition` describes a mission type and defaults.
- `MissionInstance` describes one concrete founder-directed work object.

Definitions are loaded from `control-plane/missions/definitions/`.
Instances are loaded from `control-plane/missions/instances/`.

## Lifecycle Model

Mission status is bounded to four state families:

- lifecycle: `draft | approved | active | blocked | completed | archived`
- approval: `pending_review | approved | rejected | not_required`
- readiness: `pending | ready | blocked | incomplete | inconclusive`
- completion: `not_started | in_progress | deliverables_pending | completed | inconclusive`

Status evaluation is conservative: when uncertain, it favors `incomplete` or `inconclusive`.

## Determinism Guarantees

The registry follows existing control-plane determinism primitives:

- canonical JSON serialization via `canonicalStringify`
- semantic hashing via `sha256`
- stable sorting of filesystem reads and in-memory collections

Mission IDs are derived from semantic identity inputs only:

- `missionType`
- `objective`
- `requestedDeliverables`
- `sourceReferences`
- `linkedActionPlanIds`
- `founderInstructions`
- `createdFrom.kind`

Excluded from identity:

- timestamps
- run counters
- artifact paths
- materialization outputs

## Projection and Materialization

`mission-projection.ts` composes definition, instance, status, history, and summaries into `MissionProjection`.

`mission-materializer.ts` writes projection-derived artifacts only:

- `mission-status.json`
- `mission-report.json`
- `mission-report.md`
- `mission-history.json`

Artifacts are outputs, not source of truth.

## Current Boundaries

Sprint 3.1 is strictly pre-execution.

Not included:

- mission templates
- sub-mission/DAG logic
- team invocation or execution flows
- permissions/proposals workflows
- external API or LLM execution
