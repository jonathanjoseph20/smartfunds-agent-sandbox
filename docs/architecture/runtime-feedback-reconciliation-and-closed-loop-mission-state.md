# Runtime Feedback Reconciliation and Closed-Loop Mission State (Sprint 8.3)

## Purpose

Sprint 8.3 adds deterministic closed-loop runtime outcome propagation from runtime reconciliation into mission-control layers.

Flow:

mission
-> execution coordination
-> activation
-> activation runtime integration
-> runtime feedback reconciliation
-> runtime outcome propagation
-> activation lifecycle updates
-> execution coordination updates
-> mission orchestration updates
-> mission portfolio updates

This layer is additive and does not mutate runtime semantics.

## Determinism Model

All semantic identities use:

- `canonicalStringify(...)`
- `sha256(...)`

Identity payloads exclude timestamps, filesystem paths, process IDs, and environment metadata.

All arrays and summaries are sorted deterministically before hashing and output.

## Projection-First Truth

Propagation truth is derived in projection from:

- runtime integration projections
- runtime reconciliation records
- activation projections
- execution coordination projections
- orchestration projections
- portfolio projections
- append-only propagation history

Materialized artifacts persist projection output only.

## Propagation Record

Core object: `RuntimeOutcomePropagationRecord`

Fields:

- `runtimeOutcomePropagationRecordId`
- `activationDispatchAttemptId`
- `executionActivationRecordId`
- `executionRequestRecordId`
- `propagationClass`
- `targetLayer`
- `state`
- `outcome`

Target layers:

- `activation_layer`
- `execution_coordination_layer`
- `mission_orchestration_layer`
- `mission_portfolio_layer`

## Surface Propagation Models

Activation lifecycle propagation:

- `activationLifecyclePropagationId`
- `runtimeOutcomePropagationRecordId`
- `executionActivationRecordId`
- `propagationClass`
- `reasonTokens`
- `state`

Execution coordination propagation:

- `executionCoordinationPropagationId`
- `runtimeOutcomePropagationRecordId`
- `missionExecutionCoordinationPlanId`
- `propagationClass`
- `reasonTokens`
- `state`

Mission orchestration propagation:

- `missionOrchestrationPropagationId`
- `runtimeOutcomePropagationRecordId`
- `missionControlInterventionPlanId`
- `propagationClass`
- `reasonTokens`
- `state`

Mission portfolio propagation:

- `missionPortfolioStatePropagationId`
- `runtimeOutcomePropagationRecordId`
- `missionPortfolioId`
- `propagationClass`
- `reasonTokens`
- `state`

## Status and Outcome

Status is operational propagation posture:

- `pending`
- `applied`
- `partially_applied`
- `deferred`
- `blocked`
- `failed`
- `inconclusive`

Outcome is summarized upstream change result:

- `no_change`
- `upstream_updated`
- `partially_updated`
- `blocked`
- `failed`
- `deferred`
- `inconclusive`

Status and outcome are distinct and are not collapsed.

## Append-Only Propagation History

Event types:

- `runtime_outcome_propagation_record_created`
- `activation_lifecycle_propagated`
- `execution_coordination_propagated`
- `mission_orchestration_propagated`
- `mission_portfolio_state_propagated`
- `runtime_outcome_propagation_deferred`
- `runtime_outcome_propagation_failed`
- `runtime_outcome_propagation_materialized`

History is replay-safe, dedupe-safe, and deterministically ordered by semantic event dedupe key.
