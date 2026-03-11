# Portfolio Intelligence Layer

## Scope

Sprint 2.22 adds a bounded portfolio-level intelligence layer above market intelligence synthesis.

This layer is:
- deterministic
- projection-first
- append-only for portfolio history
- CLI-inspectable
- additive to existing upstream and downstream layers

This layer is not:
- capital allocation
- trading or treasury logic
- orchestration/action systems
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
-> portfolio intelligence

## Definitions

Definitions are stored in:
- `control-plane/portfolio-intelligence/definitions/*.json`

Each definition provides:
- `portfolioId`
- `displayName`
- `portfolioType`
- `enabled`
- `matchingRules` (protocol/asset/event families and explicit synthesis/id matches)
- `readinessRules.requireAllLinkedSynthesesReady` (optional)

## Deterministic Linking

Linking consumes market synthesis inspection outputs and never mutates market synthesis state.

A market synthesis is linked only when configured deterministic family/type/id matches are satisfied and rationale is produced.

Operator-visible rationale includes:
- `shared_protocol_family:<value>`
- `shared_asset_family:<value>`
- `shared_event_family:<value>`
- `explicit_definition_match:<value>`

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
- explicit blockers produce `blocked`/`inconclusive`
- weak or conflicting support avoids optimistic completion
- completion requires coherent linked market synthesis coverage

## Risk Aggregation

Portfolio risk remains descriptive only.

Computed outputs:
- `riskThemes`
- `exposureFlags`
- `concentrationWarnings`

Example themes:
- `protocol_exposure_pressure`
- `governance_risk_rising`
- `liquidity_stress`
- `yield_instability`

## Projection vs Materialization

Projection (`portfolio-projection.ts`) computes truth by:
- loading definitions
- linking market syntheses deterministically
- evaluating lifecycle/readiness/completion
- aggregating risk surface
- composing status/report previews

Materialization (`portfolio-materializer.ts`) only persists already-computed outputs:
- `portfolio-status.json`
- `portfolio-history.json`
- `portfolio-report.json`
- `portfolio-report.md`

Materialization does not mutate lifecycle, readiness, or completion.

## Persistence

Artifacts are written under:
- `artifacts/portfolio-intelligence/<portfolioId>/`

History is append-only and deduped by deterministic fingerprinting over canonical event content (`canonicalStringify` + `sha256`).
