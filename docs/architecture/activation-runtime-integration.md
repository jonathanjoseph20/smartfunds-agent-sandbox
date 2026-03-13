# Activation Runtime Integration (Sprint 8.2)

## Purpose

Sprint 8.2 introduces a bounded runtime-dispatch integration layer between activation truth and runtime execution surfaces.

Flow:

mission
-> execution coordination
-> activation
-> activation runtime integration
-> runtime execution

This layer is additive and does not mutate activation semantics, runtime semantics, worker semantics, or mission-control truth.

## Why Separate From Activation

Activation answers whether execution handoff should occur.

Runtime integration answers how that activation handoff is represented as dispatch attempts, runtime linkages, runtime feedback ingestion, and reconciliation.

Keeping runtime integration separate preserves clear boundaries:

- activation truth remains in Sprint 8.1 activation projection/history
- runtime integration truth is projection-derived from activation + append-only integration history + runtime linkage/feedback surfaces

## Determinism Model

All semantic identities are derived from semantic payload only:

- `canonicalStringify(...)`
- `sha256(...)`

Identity payloads exclude timestamps, filesystem order, process IDs, environment metadata, and temporary paths.

All arrays and projection surfaces are sorted deterministically.

## Dispatch Attempt Model

Core object: `ActivationDispatchAttempt`

Fields:

- `activationDispatchAttemptId`
- `executionActivationRecordId`
- `executionRequestRecordId`
- `targetRuntimeDomain`
- `priority`
- `state`
- `outcome`

State:

- `created`
- `queued`
- `submitted`
- `active`
- `deferred`
- `completed`
- `failed`
- `inconclusive`

## Runtime Link Model

Core object: `ActivationRuntimeLink`

Fields:

- `activationRuntimeLinkId`
- `activationDispatchAttemptId`
- `executionActivationRecordId`
- `executionAttemptId`
- `taskExecutionRunId`
- `workerResultId`
- `runtimeLinkClass`
- `state`

Link classes:

- `dispatch_submitted`
- `runtime_started`
- `runtime_completed`
- `runtime_failed`
- `runtime_retrying`
- `runtime_inconclusive`

## Feedback Ingestion Model

Core object: `RuntimeFeedbackIngestionRecord`

Fields:

- `runtimeFeedbackIngestionRecordId`
- `activationDispatchAttemptId`
- `activationRuntimeLinkId`
- `feedbackClass`
- `reasonTokens`
- `linkedRuntimeIds`
- `state`

Feedback classes:

- `runtime_dispatch_accepted`
- `runtime_execution_started`
- `runtime_execution_completed`
- `runtime_execution_failed`
- `runtime_execution_blocked`
- `runtime_execution_retrying`
- `runtime_execution_inconclusive`

## Reconciliation Model

Core object: `ActivationRuntimeReconciliation`

Fields:

- `activationRuntimeReconciliationId`
- `activationDispatchAttemptId`
- `reconciliationClass`
- `reasonTokens`
- `linkedFeedbackRecordIds`
- `state`

Classes:

- `feedback_applied`
- `feedback_conflict`
- `feedback_incomplete`
- `feedback_deferred`
- `feedback_inconclusive`

## Projection-First Truth

Runtime integration projection derives truth from:

- activation projection input
- append-only runtime integration history
- runtime link records
- runtime feedback ingestion records

Materialized artifacts are projection outputs only.

No mutable current-state blob is used.

## Runtime Integration History

Append-only events:

- `activation_dispatch_attempt_created`
- `activation_dispatch_queued`
- `activation_dispatch_submitted`
- `activation_runtime_link_created`
- `runtime_feedback_ingested`
- `activation_runtime_reconciliation_applied`
- `activation_runtime_deferred`
- `activation_runtime_completed`
- `activation_runtime_failed`
- `activation_runtime_materialized`

History is replay-safe, dedupe-safe, and deterministically ordered by semantic dedupe key.
