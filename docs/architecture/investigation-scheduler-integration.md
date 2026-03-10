# Investigation Scheduler Integration

## Scope

Sprint 2.7 integrates investigations with scheduler cycles so investigation phases can pause, wait, retry, and resume deterministically over multiple ticks.

This layer is:
- downstream of scheduler tick semantics
- append-only and projection-driven
- bounded to investigation lifecycle progression
- deterministic and replay-safe

This layer is not:
- generalized orchestration
- swarm coordination
- free-form planning
- dashboard workflow management

## Layer Position

runtime
-> scheduler
-> persistent research
-> signal bus
-> trigger layer
-> investigation layer
-> investigation scheduler integration

Mission scheduler semantics remain unchanged. Investigation progression is a passive seam invoked after scheduler evaluation/launch processing.

## Lifecycle Model

Investigation statuses:
- `pending`
- `running`
- `awaiting_data`
- `scheduled_resume`
- `retry_pending`
- `blocked`
- `completed`
- `failed`
- `cancelled`

Transitions are centrally validated in `control-plane/investigations/investigation-lifecycle.ts`.

## Phase Scheduling Contract

Each phase can declare bounded scheduling metadata:
- `executionMode`: `immediate` | `next_tick` | `delayed`
- `minDelaySlots`: non-negative integer delay
- `waitCondition`: `fixed_slot_delay` | `new_dataset_observation`
- `retryPolicy`: `never` | `bounded`
- `maxRetries`: non-negative integer

This is intentionally narrow and not a generalized workflow DSL.

## Durable State And History

Source of truth remains append-only events in:
- `investigations/<YYYY-MM-DD>/investigation-events.json`

Key events added for long-running progression:
- `LIFECYCLE_TRANSITION_RECORDED`
- `PHASE_SLOT_ADVANCEMENT_RECORDED`
- `PHASE_RETRY_SCHEDULED`
- `PHASE_WAITING_FOR_DATA`
- `PHASE_SCHEDULED_RESUME`

Current state, due state, retry metadata, and wait metadata are derived by projection from event history.

## Due Evaluation

Due evaluation is deterministic and slot-based:
- terminal investigations are not due
- duplicate same phase + same investigation + same scheduler slot is suppressed
- scheduled/retry states respect `nextEligibleSlot`
- `awaiting_data` requires deterministic data condition satisfaction

The investigation scheduler seam maps scheduler evaluations to stable slot IDs and advances only due investigations.

## Duplicate Advancement Suppression

Duplicate suppression for progression is durable:
- each advancement writes `PHASE_SLOT_ADVANCEMENT_RECORDED`
- later evaluations for the same `{ investigationRunId, phaseId, schedulerSlot }` are ignored

No in-memory-only guard is relied upon.

## Retry And Recovery

Retry behavior is phase-level, bounded, and deterministic:
- retry classification and limits are lifecycle-driven
- retry scheduling records `retryIndex` and `nextEligibleSlot`
- exhausted retry paths transition to terminal failure

## Report Continuity

Final report generation remains tied to terminal completion only.

`investigation-report.json` and `investigation-report.md` are written exactly once per run when all phases complete.

## Passive Integration Contract

`research:scheduler:tick` calls investigation progression as a passive downstream seam.

If investigation progression throws, scheduler output and mission launch semantics remain intact.
