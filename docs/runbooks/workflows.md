# Workflows Runbook

## Authoring a Workflow

Create JSON workflow definitions in:

- `control-plane/workflows/definitions/<workflow-id>.json`

Required fields:

- `workflowId`: non-empty string
- `nodes`: non-empty array

Node fields:

- `id`: non-empty string, unique within workflow
- `task`: non-empty string
- `agent` (optional): agent binding passed to runtime executor
- `dependsOn` (optional): array of node IDs
- `phase` (optional): descriptive phase label

`dependsOn` defaults to `[]` when omitted.

## Dependency Rules

- dependency IDs must exist in `nodes`
- self-dependency is rejected
- cycles are rejected
- execution order is deterministic with lexicographic tie-breaks

## previousOutputs Behavior

A node receives `previousOutputs` keyed by dependency node ID.

Example for a node depending on `market-research` and `regulatory-scan`:

```json
{
  "market-research": { "...": "..." },
  "regulatory-scan": { "...": "..." }
}
```

Only declared upstream dependencies are propagated.

## Validate a Workflow

```bash
npm run workflow:validate -- --workflow rwa-market-analysis
```

Success output (JSON):

```json
{"valid":true,"workflowId":"rwa-market-analysis"}
```

Failure output (JSON) includes deterministic error text and exits non-zero.

## Inspect a Workflow

```bash
npm run workflow:inspect -- --workflow rwa-market-analysis
```

Output includes:

- `workflowId`
- normalized nodes
- dependencies
- deterministic `executionOrder`

## Common Authoring Errors

- duplicate node IDs
- dependency references missing node IDs
- self-dependency
- dependency cycles
- missing required node fields (`id`, `task`)

## Determinism Checklist

- keep node IDs stable
- avoid semantic duplicates in dependency lists
- rely on inspect output to verify final deterministic order
