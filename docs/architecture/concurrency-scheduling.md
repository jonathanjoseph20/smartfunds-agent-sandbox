# Concurrency Scheduling (Sprint 6.4)

## Scope

Sprint 6.4 adds deterministic concurrency-aware scheduling to task execution.
The runtime remains simulation-only: no workers, no async queueing, no leasing, and no network coordination.

## Position in Runtime Pipeline

task graph -> task execution engine -> retry/failure semantics -> concurrency scheduler

The scheduler consumes projection + history truth and emits append-only scheduling events.

## Runnable vs Ready

`ready` is a node lifecycle state.
`runnable` is a scheduler eligibility result for a wave.

A node is runnable only when all are true:
- node state is `ready`
- not blocked
- not running
- not retry-waiting (`retrying`)
- not completed/skipped

This separation prevents semantic merging between node lifecycle and scheduling decisioning.

## Deterministic Ordering

Runnable order is always computed by explicit comparator:
1. dependency depth ascending
2. retry priority rank (policy-driven)
3. attempt index ascending
4. lexical `nodeId` ascending

No insertion-order or map-iteration order is used for persisted arrays.

## Concurrency Policies

Policies are static seeded constants (`task-concurrency-policies.ts`) and selected explicitly.
There is no dynamic adaptation.

Key knobs:
- `maxConcurrentNodes`
- `schedulingStrategy`
- `retryPriorityMode`
- `sameLevelParallelismAllowed`

## Scheduling Waves and Slots

A wave is the deterministic selection result for one scheduler cycle.

Slot model in Sprint 6.4:
- each node consumes 1 slot
- available slots = `policy.maxConcurrentNodes`
- scheduled nodes = first N from fully ordered runnable set
- remaining runnable nodes = deferred by limit

Deferred nodes are capacity-constrained, not dependency-blocked.

## History and Replay

New append-only event types:
- `concurrency_wave_evaluated`
- `concurrency_slots_allocated`
- `node_scheduled_for_execution`
- `node_deferred_by_concurrency_limit`
- `concurrency_wave_completed`

Projection derives concurrency state from these events.
Legacy runs without these events replay with deterministic defaults.

## Retry/Failure Interaction

Retry eligibility remains owned by Sprint 6.3 logic.
Concurrency scheduler only consumes resulting node state and retry-attempt metadata.
Scheduler does not reclassify failures or redefine retry semantics.
