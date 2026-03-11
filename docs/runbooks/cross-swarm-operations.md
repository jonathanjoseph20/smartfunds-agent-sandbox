# Cross-Swarm Operations

## Purpose

This runbook covers deterministic inspection and materialization of bounded cross-swarm coordination units.

## Commands

List cross-swarm units:

```bash
npm run cross-swarms:list
```

Inspect one cross-swarm unit:

```bash
npm run cross-swarms:inspect -- --cross-swarm <id>
```

Inspect lifecycle/readiness/completion summary:

```bash
npm run cross-swarms:status -- --cross-swarm <id>
```

Inspect linked swarms and rationale:

```bash
npm run cross-swarms:links -- --cross-swarm <id>
```

Inspect readiness blockers/conflicts:

```bash
npm run cross-swarms:readiness -- --cross-swarm <id>
```

Inspect append-only history:

```bash
npm run cross-swarms:history -- --cross-swarm <id>
```

Materialize artifacts:

```bash
npm run cross-swarms:materialize -- --cross-swarm <id>
```

## Operator Interpretation

Readiness:
- `pending`: insufficient linked swarm progress
- `analyzing`: linked swarms are in-flight but not coherent
- `coherent`: linked swarms form a coherent bounded response with no blockers/conflicts
- `blocked`: blockers/conflicts remain

Lifecycle:
- `inactive`: no meaningful linked activity
- `initializing`: early linked activity, no material progression yet
- `active`: linked swarms activated
- `progressing`: linked swarms moving through active work
- `stabilizing`: linked swarms near bounded closure while stabilizing
- `completed`: deterministic completion requirements satisfied

Completion:
- `isComplete=true` only when all required completion rules are met
- review `unmetRequirements[]` whenever incomplete

## Artifact Locations

Per cross-swarm unit:
- `artifacts/cross-swarms/<crossSwarmId>/cross-swarm-status.json`
- `artifacts/cross-swarms/<crossSwarmId>/cross-swarm-history.json`
- `artifacts/cross-swarms/<crossSwarmId>/cross-swarm-report.json`
- `artifacts/cross-swarms/<crossSwarmId>/cross-swarm-report.md`

## Boundary

These commands are for bounded cross-swarm coordination only.

Out of scope:
- portfolio-level intelligence
- generalized orchestration planners
- dashboards
- Slack automation
- trading/treasury logic
