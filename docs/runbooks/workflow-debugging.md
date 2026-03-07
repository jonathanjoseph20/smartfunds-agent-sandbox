# Workflow Debugging Runbook

## Recommended Inspection Sequence

1. Inspect run-level summary.

```bash
npm run workflow:run-inspect -- --run <runId>
```

2. Inspect first failed node (or active node if no failure).

```bash
npm run workflow:node-inspect -- --run <runId> --node <nodeId>
```

3. Inspect deterministic execution trace.

```bash
npm run workflow:trace -- --run <runId>
```

4. Inspect failure diagnostics for normalized code/details.

```bash
npm run workflow:failures -- --run <runId>
```

## What to Check

- run status and sequence boundary
- first failed node and last successful node
- dependency chain (`dependsOn`) for failed node
- task input/output mismatches
- context diff (`addedKeys`, `updatedKeys`, `removedKeys`)
- adapter/agent binding and failure code mapping

## Deterministic Re-check

Repeat the same command on unchanged runtime state. Output should remain serialization-identical.
