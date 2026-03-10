# Mission Scheduler Foundation

## Scope
Sprint 2.2 adds a deterministic recurring mission scheduler foundation.

It provides:
- machine-readable recurring schedule definitions
- deterministic due evaluation
- deterministic slot identity
- duplicate-safe launch journaling
- runtime launch integration through `createMissionService().startMission(...)`
- operator inspection surfaces

It does not add:
- persistent agents
- team orchestration semantics
- signal/event trigger buses
- Slack-first controls
- dashboard redesign

## Cadence Types
Supported schedule cadence types:
- `daily`
- `interval_hours`
- `interval_minutes`

No cron parser is introduced.

## Slot Identity
Slot identity is deterministic and UTC-based.

Examples:
- `daily:2026-03-10`
- `interval_hours:6:2026-03-10T12:00Z`
- `interval_minutes:15:2026-03-10T12:30Z`

Duplicate prevention key is `scheduleId + slotId`.

## Due Evaluation Contract
Each schedule evaluates to one of:
- `due`
- `not_due`
- `already_launched_for_slot`
- `disabled`
- `invalid_schedule`

Daily schedules are due once per UTC day at or after configured `hourUtc`/`minuteUtc`.
Interval schedules are due for the deterministic current interval boundary.

## Duplicate Prevention
Scheduler launch journal records a slot attempt before calling mission runtime.
Any attempted slot is consumed, including failed launches.

Result:
- same slot is never re-launched by repeated ticks
- failures remain visible and still block duplicate re-launch in the same slot

## Runtime Integration
Scheduled launch path is the existing hardened runtime path only:
- scheduler service -> `createMissionService().startMission(...)`

No parallel mission execution path is introduced.
