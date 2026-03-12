# Mission Task Graph Operations

## Scope

Sprint 6.1 task graph operations are structural and deterministic:

- evaluate
- list
- inspect
- status
- history
- materialize

All commands emit canonical JSON with stable error payloads:

- `{ "error": "message" }`

## Prerequisite

A mission should already have an evaluated execution engine run.
Typical upstream chain:

- `team-compatibility:evaluate`
- `mission-assignment:confirm`
- `mission-activation:evaluate`
- `execution-contract:evaluate`
- `runtime-envelope:confirm`
- `execution-attempt:create`
- `execution-journal:evaluate`
- `execution-engine:evaluate`

## Evaluate Task Graph

```bash
npm run task-graph:evaluate -- --engine-run <executionEngineRunId>
```

Effects:

- derives deterministic task graph structure from execution-engine/runtime-envelope projections
- validates graph (references, dependency type, cycle, connectivity)
- appends bounded task-graph history events

## List Task Graphs

```bash
npm run task-graph:list
```

Returns summary rows:

- `taskGraphId`
- `missionId`
- `nodeCount`
- `graphState`

## Inspect Task Graph

```bash
npm run task-graph:inspect -- --graph <taskGraphId>
```

Returns full projection:

- graph/node/edge model
- derived state counts
- provenance and limitations
- artifact paths

## Task Graph Status

```bash
npm run task-graph:status -- --graph <taskGraphId>
```

Returns compact state and counts for quick operational checks.

Interpretation:

- `ready_for_execution`: at least one node is ready and no blocking terminal condition is derived
- `blocked`: failed/blocked nodes exist, or dependency constraints prevent any progress

## Task Graph History

```bash
npm run task-graph:history -- --graph <taskGraphId>
```

Returns append-only event history with deterministic:

- `eventIndex`
- `eventDedupeKey`

## Materialize Task Graph Artifacts

```bash
npm run task-graph:materialize -- --graph <taskGraphId>
```

Writes deterministic files to:

- `artifacts/task-graph/<taskGraphId>/`

Files:

- `task-graph-status.json`
- `task-graph-report.json`
- `task-graph-report.md`
- `task-graph-history.json`
- `task-graph-nodes.json`
- `task-graph-edges.json`

## Determinism Checks

1. Run `task-graph:evaluate` twice with the same `executionEngineRunId`.
2. Run `task-graph:materialize` twice for the same graph.
3. Verify stable IDs and identical artifact file contents.
