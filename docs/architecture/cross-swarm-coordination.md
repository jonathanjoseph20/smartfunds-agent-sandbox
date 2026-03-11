# Cross-Swarm Coordination Layer

## Scope

Sprint 2.20 adds a bounded cross-swarm coordination layer.

This layer is:
- deterministic
- projection-first
- bounded by explicit cross-swarm definitions
- append-only for cross-swarm history
- operator-inspectable via CLI

This layer is not:
- portfolio intelligence
- treasury/trading logic
- generalized orchestration
- dynamic agent assignment
- dashboards
- Slack automation

## Layer Position

runtime
-> scheduler
-> persistent runtime
-> signal bus
-> trigger layer
-> investigations
-> synthesis
-> cohorts
-> monitoring programs
-> automation
-> escalation
-> research teams
-> team coordination
-> research swarms
-> team-swarm coordination
-> cross-swarm coordination

## Cross-Swarm Unit Contract

A cross-swarm unit is defined by explicit JSON definition files in:
- `control-plane/cross-swarms/definitions/*.json`

Each definition includes:
- `crossSwarmId`
- `displayName`
- `groupType`
- `enabled`
- `scope` (`teamIds`, `subjectKeys`)
- `include` filters (`swarmIds`, `teamIds`, protocol/asset/event/cohort families)
- `requiredMatchDimensions`
- `completionRules`

## Deterministic Grouping And Link Rationale

Grouping uses existing lower-layer inspection surfaces and explicit match dimensions only:
- `explicit_definition_match`
- `shared_team_ownership`
- `shared_protocol_family`
- `shared_asset_family`
- `shared_event_family`
- `shared_cohort_family`

A swarm is linked only when:
- scope filters pass
- include filters pass
- every required match dimension is satisfied

Each linked swarm emits explicit rationale entries so operators can answer why the swarm belongs in the unit.

## Lifecycle, Readiness, Completion

Cross-swarm lifecycle states:
- `inactive`
- `initializing`
- `active`
- `progressing`
- `stabilizing`
- `completed`

Cross-swarm readiness states:
- `pending`
- `analyzing`
- `coherent`
- `blocked`

Completion is projection-derived and bounded by definition rules, including:
- all linked swarms complete
- no blocked linked swarms
- no unresolved conflicts
- coherent readiness

This layer does not mutate lower layers and does not auto-close swarms/teams.

## Conflict, Blocker, Limitation Surface

Cross-swarm projection explicitly exposes:
- `blockers`
- `conflicts`
- `limitations`
- `unmetRequirements`

Disagreement is never hidden to force a tidy aggregate state.

## Projection vs Materialization

Projection defines truth.

Materialization only persists projection output:
- `cross-swarm-status.json`
- `cross-swarm-history.json`
- `cross-swarm-report.json`
- `cross-swarm-report.md`

Materialization does not alter readiness, lifecycle, or completion.

## Persistence

Cross-swarm artifacts are stored at:
- `artifacts/cross-swarms/<crossSwarmId>/`

History is append-only with deterministic dedupe keys based on canonical serialized event content.

## Roadmap Boundary

This layer provides bounded coordination over related swarms and is compatible with future higher-level portfolio/venture layers.

No higher-order portfolio or venture orchestration logic is implemented in this sprint.
