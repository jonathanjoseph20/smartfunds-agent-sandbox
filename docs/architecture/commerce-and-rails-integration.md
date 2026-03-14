# Commerce and Rails Integration (PF-8)

## Purpose

PF-8 introduces a deterministic commerce layer above Build Evidence.

Flow after PF-8:

ProductSpec
-> EngineeringPlan
-> ImplementationTaskGraph
-> CodexExecutionPackets
-> RepositoryScaffoldBundles
-> BuildExecutionRuns
-> BuildEvidenceBundles
-> Commerce / Rails Integration

PF-8 does not mutate upstream truth. It consumes trusted evidence and derives bounded commerce truth.

## Why Commerce Is Separate from Execution Evidence

- Execution and evidence answer what was built and whether governance can trust it.
- Commerce answers whether trusted output maps to a monetizable event.
- Keeping these layers separate preserves deterministic replay and avoids coupling monetization policy to runtime execution semantics.
- Materialized artifacts are outputs, not semantic source of truth.

## Charge Intent Model

`ChargeIntent` is the deterministic monetization entrypoint derived from trusted build evidence.

Representative fields:

- `chargeIntentId`
- `buildEvidenceBundleId`
- `runId`
- `productSpecId`
- `monetizationClass`
- `amount`
- `currency`
- `payTo`
- `railClasses`
- `status`
- `outcome`

Identity rule:

`canonicalStringify(payload) -> sha256 -> chargeIntentId`

Excluded from identity:

- timestamps
- filesystem paths
- process metadata
- environment metadata
- temporary runtime state

## Rail Binding Model

`RailBinding` links a charge intent to one or more abstract rails:

- `stripe`
- `evm_wallet`
- `erebor`

Binding classes:

- `primary_binding`
- `fallback_binding`
- `manual_binding`
- `blocked_binding`

PF-8 binding is deterministic and replay-safe.

## Rail Eligibility Model

`RailEligibility` evaluates whether each bound rail can fulfill a charge intent.

Statuses:

- `eligible`
- `conditionally_eligible`
- `blocked`
- `incompatible`
- `inconclusive`

Eligibility is derived logic and does not call external APIs.

## Receipt Model

`PaymentReceipt` records deterministic payment attempt posture.

Receipt classes:

- `payment_received`
- `payment_pending`
- `payment_failed`
- `payment_blocked`
- `payment_inconclusive`

Receipts can be derived from eligibility posture or recorded manually through bounded CLI inputs.

## Settlement Log Model

`SettlementLog` represents deterministic lifecycle posture from receipts.

Settlement classes:

- `settlement_pending`
- `settlement_completed`
- `settlement_failed`
- `settlement_blocked`
- `settlement_inconclusive`

## Commerce Status and Outcome

Internal status:

- `draft`
- `pending`
- `fulfilled`
- `blocked`
- `failed`
- `inconclusive`

Outcome:

- `no_charge`
- `pending_settlement`
- `settled`
- `blocked`
- `failed`
- `inconclusive`

Both are projection-derived and deterministic.

## Append-Only Commerce History

History events are append-only, deterministic, deduplicated by semantic identity, and replay-safe.

Events:

- `charge_intent_created`
- `rail_binding_recorded`
- `rail_eligibility_evaluated`
- `payment_receipt_recorded`
- `settlement_logged`
- `commerce_materialized`
- `commerce_failed`

## Materialization

PF-8 materializes projection output under:

`artifacts/commerce/<chargeIntentId>/`

Files:

- `commerce-status.json`
- `commerce-rail-bindings.json`
- `commerce-rail-eligibility.json`
- `commerce-payment-receipts.json`
- `commerce-settlement-log.json`
- `commerce-history.json`
- `commerce-outcome.json`
- `commerce-report.json`
- `commerce-report.md`

## Scope Boundary and Non-Goals

PF-8 does not implement:

- treasury strategy
- general accounting
- publishing/deployment pipelines
- billing UI
- venture finance orchestration
- external rail SDK or network integrations

PF-8 is a deterministic abstraction layer for monetizable execution, not a treasury or venture finance system.
