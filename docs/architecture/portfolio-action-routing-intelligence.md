# Portfolio Action Routing Intelligence

## Scope

Sprint 2.23 adds a deterministic portfolio action routing intelligence layer directly above portfolio intelligence.

This layer is:
- deterministic
- definition-driven
- projection-first
- append-only for history
- CLI-inspectable
- descriptive only

This layer is not:
- capital allocation
- rebalancing proposals
- trade execution
- treasury logic
- autonomous routing side effects

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
-> portfolio action routing intelligence

## Definitions

Definitions are stored in:
- `control-plane/portfolio-actions/definitions/*.json`

Each definition provides:
- `actionId`
- `displayName`
- `actionType`
- `enabled`
- `portfolioMatchRules` (risk themes, exposure flags, concentration warnings, market event families)
- optional `readinessRules`, `blockingRules`, and `priorityRules`

Definitions load in deterministic order and are validated/rejected on schema and duplicate ID violations.

## Deterministic Linking

Linking consumes portfolio intelligence projections read-only and never mutates upstream state.

A portfolio is linked to an action candidate only when configured deterministic rules match.

Operator-visible rationale includes:
- `explicit_definition_match:<value>`
- `shared_risk_theme:<value>`
- `shared_exposure_flag:<value>`
- `shared_concentration_warning:<value>`
- `shared_market_event_family:<value>`

## Readiness Model

Readiness states:
- `pending`
- `analyzing`
- `ready`
- `blocked`

Conservative blocker-first reasoning is applied, including:
- `blocked_portfolio_intelligence`
- `contradictory_exposure_signals`
- `insufficient_portfolio_coverage`
- `weak_support_for_action_candidate`
- `unresolved_market_conflicts`
- `incomplete_upstream_readiness`

When uncertain, readiness remains blocked rather than overstated.

## Completion Model

Completion states:
- `completed`
- `incomplete`
- `inconclusive`

`completed` means action intelligence is stabilized, not executed.

When uncertainty/conflict is present, completion remains `inconclusive`.

## Priority Model

Priority levels:
- `low`
- `normal`
- `high`
- `critical`

Priority derives deterministically from:
- risk themes
- concentration warnings
- readiness and blockers
- conflict/contradiction severity

## Route Categories

Route category is descriptive only and always one of:
- `monitor`
- `review`
- `escalate`
- `prepare_allocation_review`

No route category triggers execution.

## Projection/Materialization Boundary

Projection/inspection computes truth by composing:
- definitions registry
- portfolio linker
- readiness/completion/priority evaluators
- status projection
- history summary and artifact previews

Materialization only persists already computed projection outputs:
- `action-status.json`
- `action-history.json`
- `action-report.json`
- `action-report.md`

Materialization never changes readiness, lifecycle, completion, priority, or route category.

## Persistence

Artifacts are written under:
- `artifacts/portfolio-actions/<actionId>/`

History is append-only and deduplicated via canonical content fingerprinting (`canonicalStringify` + `sha256`).
