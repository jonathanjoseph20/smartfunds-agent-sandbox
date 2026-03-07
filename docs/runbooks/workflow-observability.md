# Workflow Observability Runbook

## List Workflow Runs

```bash
npm run workflow:runs
```

Optional:

```bash
npm run workflow:runs -- --limit 10
```

Output is JSON-first list entries:

- `runId`
- `workflowId`
- `missionId`
- `status`
- `completedNodeCount`
- `failedNodeCount`

## Inspect a Workflow Run

```bash
npm run workflow:run-inspect -- --run <runId>
```

Output includes:

- structured `summary`
- workflow/mission/team/project metadata
- node status list
- active and failed node signals
- final context keys
- deterministic `firstInspectTarget`

## Inspect a Workflow Node

```bash
npm run workflow:node-inspect -- --run <runId> --node <nodeId>
```

Output includes:

- node definition/dependencies
- agent/adapter
- task inputs/outputs
- previous outputs
- context diff
- failure details (if present)
- sequence boundaries

## Inspect Workflow Trace

```bash
npm run workflow:trace -- --run <runId>
```

Output is a deterministic sequence-ordered trace from run start to completion/failure boundary.

## Inspect Workflow Failures

```bash
npm run workflow:failures -- --run <runId>
```

Output includes:

- normalized failure records
- failure categories
- deterministic first inspection target
