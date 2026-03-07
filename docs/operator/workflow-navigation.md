# Workflow Navigation

Sprint 72 adds mission-aligned workflow inspection and runtime control through the operator command router.

## CLI Commands
```bash
npm run operator -- workflow:list
npm run operator -- workflow:inspect <runId>
npm run operator -- workflow:trace <runId>
npm run operator -- workflow:retry --run <runId> --node <nodeId>
npm run operator -- workflow:resume --run <runId>
npm run operator -- workflow:cancel --run <runId>
```

## Inspection Model
Inspection data is journal-derived and observability-derived only.
No parallel state store is introduced.

`workflow:inspect` includes:
- run status
- node status summary
- retries/timeouts
- diagnostics summary

`workflow:trace` includes:
- deterministic execution order
- retry events
- failure events
- full sequence-ordered trace payload

## Runtime Controls
`workflow:retry`, `workflow:resume`, and `workflow:cancel` route to the existing recovery/runtime enforcement APIs.
Commands return success only when runtime accepts and records the action.
