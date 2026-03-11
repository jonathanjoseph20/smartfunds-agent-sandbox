# Market Intelligence Synthesis Layer

## Scope

Sprint 2.21 adds a bounded market-level intelligence synthesis layer above cross-swarm coordination.

This layer is:
- deterministic
- projection-first
- append-only for market synthesis history
- CLI-inspectable
- additive to existing lower layers

This layer is not:
- portfolio allocation
- treasury/trading logic
- orchestration planning
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
-> market intelligence synthesis

## Definitions

Definitions are stored in:
- `control-plane/market-synthesis/definitions/*.json`

Each definition provides:
- `marketSynthesisId`
- `displayName`
- `synthesisType`
- `enabled`
- `crossSwarmMatchingRules` (event/protocol/asset/response families)
- `scopeConstraints.minCrossSwarms` (optional)

## Deterministic Linking

Linking consumes cross-swarm inspection outputs and never mutates cross-swarms.

A cross-swarm is linked only when configured rule families match and deterministic rationale is produced.
Rationale is operator-visible and includes explicit values, for example:
- `cross_swarm_id:shared_event_family:market`
- `cross_swarm_id:shared_protocol_family:aave`
- `cross_swarm_id:shared_response_family:market`
- `cross_swarm_id:explicit_definition_match:market`

## Readiness And Completion Model

Readiness states:
- `pending`
- `analyzing`
- `coherent`
- `blocked`

Completion states:
- `completed`
- `incomplete`
- `inconclusive`

Heuristics are conservative:
- prefer `blocked` when explicit blockers/conflicts/contradictions exist
- prefer `inconclusive` when coverage is weak or support is insufficient
- do not infer certainty from partial signals

## Projection vs Materialization

Projection computes truth by:
- loading market synthesis definitions
- linking cross-swarm units deterministically
- evaluating lifecycle/readiness/completion
- composing status/report previews

Materialization only persists the current projection outputs:
- `market-synthesis-status.json`
- `market-synthesis-history.json`
- `market-synthesis-report.json`
- `market-synthesis-report.md`

Materialization does not change readiness or lifecycle states.

## Persistence

Artifacts are written under:
- `artifacts/market-synthesis/<marketSynthesisId>/`

History is append-only and deduped by deterministic fingerprinting over canonical event content (`canonicalStringify` + `sha256`).
