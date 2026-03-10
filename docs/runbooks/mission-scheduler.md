# Mission Scheduler Runbook

## Registry
Scheduler registry file:
- `control-plane/scheduler/registry.json`

Definition shape:
- `scheduleId`
- `missionId`
- `enabled`
- `cadence`
- optional `params`
- optional `maxLaunchesPerSlot` (must be `1` when present)

Registry load and output are deterministic and key-sorted.

## Operator Commands
List schedules:

```bash
npm run schedules:list
```

Inspect one schedule:

```bash
npm run schedules:inspect -- --schedule <scheduleId>
```

View launch history:

```bash
npm run schedules:history -- --schedule <scheduleId>
```

Run a scheduler tick:

```bash
npm run scheduler:tick
```

Optional dry-run (evaluation only):

```bash
npm run scheduler:tick -- --dry-run
```

## Due Semantics
Evaluation statuses:
- `due`
- `not_due`
- `already_launched_for_slot`
- `disabled`
- `invalid_schedule`

Daily cadence runs once per UTC day at/after configured time.
Interval cadence runs on deterministic UTC interval boundaries.

## Duplicate Prevention + Failure Behavior
Before launch, scheduler records a deterministic attempt for `scheduleId + slotId`.

If launch fails:
- failure is persisted in history (`launchError`)
- slot remains consumed
- repeated ticks in same slot return `already_launched_for_slot`

## Runtime Path
Scheduled missions execute through existing mission runtime entrypoint:
- `createMissionService().startMission(...)`

Manual mission commands remain unchanged.

## Roadmap Boundary
This scheduler is a foundation for future persistent/runtime automation work.
It does not implement persistent research teams, signal automation, or orchestration beyond recurring cadence execution.
