# Mission Coordination Operations

## Overview
This runbook covers operator workflows for mission coordination lifecycle management.

Coordination commands append deterministic coordination events only. They do not mutate runtime task execution state.

## Inspect Current Coordination
Inspect lifecycle:
```bash
npm run mission-control:lifecycle -- --run <missionRunId>
```

Inspect full coordination status:
```bash
npm run mission-control:coordination -- --run <missionRunId>
```

Inspect dependencies:
```bash
npm run mission-control:dependencies -- --run <missionRunId>
```

Inspect priority:
```bash
npm run mission-control:priority -- --run <missionRunId>
```

Inspect interventions:
```bash
npm run mission-control:interventions -- --run <missionRunId>
```

Inspect append-only coordination history:
```bash
npm run mission-control:coordination-history -- --run <missionRunId>
```

## Pause / Resume / Cancel
Pause mission coordination:
```bash
npm run mission-control:pause -- --run <missionRunId> --by operator --reason manual_pause
```

Resume mission coordination:
```bash
npm run mission-control:resume -- --run <missionRunId> --by operator --reason resume_ready
```

Cancel mission coordination:
```bash
npm run mission-control:cancel -- --run <missionRunId> --by operator --reason intentional_cancel
```

If lifecycle transition is invalid, command returns stable error payload:
```json
{
  "error": "invalid_lifecycle_transition",
  "fromState": "...",
  "toState": "...",
  "missionRunId": "..."
}
```

## Reprioritize
Update coordination-facing priority:
```bash
npm run mission-control:reprioritize -- --run <missionRunId> --priority high --by operator --reason risk_signal
```

Priority values:
- `critical`
- `high`
- `normal`
- `low`
- `deferred`

Priority updates affect coordination reporting surfaces only.

## Dependency Blocking Visibility
Dependency blocking is exposed through:
- `mission-control:dependencies`
- `mission-control:coordination`

Projection derives:
- `blockingMissionRunIds`
- `coordinationState` (for example `blocked_by_dependency`)
- `resumeEligibility`

## Materialize Coordination Artifacts
Materialize current coordination projection and history:
```bash
npm run mission-control:materialize-coordination -- --run <missionRunId>
```

Artifacts are written under:
- `artifacts/mission-control/<missionRunId>/`

Files produced:
- `mission-coordination-status.json`
- `mission-lifecycle.json`
- `mission-interventions.json`
- `mission-dependencies.json`
- `mission-priority.json`
- `mission-coordination-history.json`
- `mission-coordination-report.md`

## Determinism And Replay
To verify deterministic replay:
1. Run `mission-control:coordination-history` twice for same run.
2. Compare outputs; they must be identical.
3. Materialize coordination twice.
4. Compare artifact file content; outputs must be stable for identical inputs.
