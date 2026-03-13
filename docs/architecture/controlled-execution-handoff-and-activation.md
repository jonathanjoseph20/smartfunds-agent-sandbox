# Controlled Execution Handoff and Activation

## Purpose

Sprint 8.1 introduces a deterministic control-plane handoff layer between mission execution coordination and runtime execution. The layer converts execution request records into explicit activation records with append-only activation history.

This layer does not change runtime semantics, worker semantics, or mission execution coordination truth.

## Inputs and Truth Model

Activation truth is projection-derived from:

- mission execution coordination projection (execution requests)
- append-only activation history
- explicit activation feedback links

No hidden mutable "current activation state" store exists.

## Deterministic Identity

All semantic identifiers are derived with:

- `canonicalStringify(payload)`
- `sha256(...)`

The identity payloads exclude timestamps, paths, process IDs, and environment metadata.

## Core Models

- `ExecutionActivationRecord`: control-plane handoff object per execution request.
- `ExecutionRequestActivationMapping`: explainable request-to-activation rule mapping.
- `ExecutionActivationEligibility`: bounded eligibility assessment per request.
- `MissionExecutionActivationQueueEntry`: deterministic queue posture.
- `ExecutionActivationFeedbackLink`: linkage from activation to runtime execution identifiers.
- `ExecutionActivationStatusRecord`: derived status.
- `ExecutionActivationOutcome`: derived outcome.
- `ExecutionActivationHistory`: append-only, replay-safe history.

## State Model

Eligibility:

- `not_eligible`
- `conditionally_eligible`
- `eligible`
- `blocked_from_activation`
- `inconclusive`

Activation status:

- `not_started`
- `pending_activation`
- `handoff_submitted`
- `activation_active`
- `activation_completed`
- `activation_failed`
- `activation_deferred`
- `inconclusive`

Activation outcome:

- `pending`
- `submitted`
- `active`
- `partially_completed`
- `completed`
- `failed`
- `deferred`
- `inconclusive`

Queue state:

- `queued`
- `awaiting_handoff`
- `handoff_submitted`
- `under_activation`
- `deferred`
- `closed`
- `blocked`

## History Events

- `execution_activation_record_created`
- `execution_activation_eligibility_evaluated`
- `execution_activation_queued`
- `execution_activation_handoff_submitted`
- `execution_activation_feedback_linked`
- `execution_activation_deferred`
- `execution_activation_completed`
- `execution_activation_failed`
- `mission_execution_activation_materialized`

History dedupe is semantic, using deterministic event payload hashing.

## Projection and Replay

`mission-execution-activation-projection.ts` computes replay-stable activation projections for all activation records. Queue ordering is deterministic:

- priority rank
- activation record ID

## Materialization

Artifacts are projection outputs only and are written to:

- `artifacts/mission-control/activation/<executionActivationRecordId>/`

Files:

- `mission-execution-activation-status.json`
- `mission-execution-activation-mapping.json`
- `mission-execution-activation-eligibility.json`
- `mission-execution-activation-queue.json`
- `mission-execution-activation-feedback-links.json`
- `mission-execution-activation-history.json`
- `mission-execution-activation-outcome.json`
- `mission-execution-activation-report.json`
- `mission-execution-activation-report.md`
