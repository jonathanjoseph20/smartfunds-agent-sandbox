# Worker Scheduling and Execution Orchestration

## Purpose

Sprint 6.6 adds a runtime-owned, deterministic orchestration layer for task execution. The layer computes assignment decisions for runnable nodes, derives worker queue state, and records orchestration cycles as append-only history.

This is control-plane orchestration only. It does not add daemons, polling, distributed queues, or network coordination.

## Design

The orchestration layer is implemented under `control-plane/task-execution/`:

- `task-execution-orchestrator.ts`: runs orchestration cycles and emits orchestration history events.
- `task-worker-scheduler.ts`: deterministic worker selection and assignment/defer decisions.
- `task-worker-queue.ts`: queue projection from orchestration history plus claim/result transitions.
- `task-assignment-decision.ts`: assignment decision model, seeded scheduling policies, deterministic assignment decision IDs.
- `task-orchestration-history-store.ts`: append-only orchestration history events.
- `task-orchestration-projection.ts`: replay-first orchestration truth (cycles, assignments, deferrals, queue/load).
- `task-orchestration-inspection.ts`: operator-facing read and cycle-control API.
- `task-orchestration-materializer.ts`: deterministic orchestration artifacts.

## Determinism

Semantic identities and dedupe keys are deterministic and derived from canonical payload hashing:

- `assignmentDecisionId`
- `orchestrationCycleId`
- `queueEntryId`

All scheduling and output ordering use explicit stable sort rules. No timestamps, UUID randomness, async timing order, or filesystem order are used for semantic decisions.

## Assignment Decision Model

`WorkerAssignmentDecision` is runtime-owned and separate from worker claims.

Decision states:

- `assigned`
- `deferred`
- `rejected`
- `incompatible`
- `capacity_exhausted`
- `worker_unavailable`

Deferrals include explicit reason tokens such as:

- `no_compatible_worker`
- `no_capacity`
- `worker_disabled`
- `worker_paused`
- `worker_unavailable`
- `deterministic_ordering_deferred`

## Worker Queue Projection

Queue state is projected from:

- orchestration assignment events
- worker claim events
- worker execution started/completed/failed events

Queue states:

- `queued`
- `claimed`
- `running`
- `completed`
- `failed`
- `cancelled`

Queue truth is projection-derived. Materialized queue files are read artifacts only.

## Orchestration Cycles

Each cycle emits:

- `orchestration_cycle_started`
- assignment evaluation/created/deferred events
- queue update events
- `orchestration_cycle_completed`

Cycle summary includes runnable nodes, eligible workers, decision IDs, deferred nodes, and cycle state.

## Relationship to Worker Claims

Orchestration creates assignment decisions and queue intent. Worker claims/results remain authoritative for claim and execution transitions.

Existing retry/failure and task concurrency semantics are preserved. Orchestration consumes those layers and records deterministic assignment ownership.
