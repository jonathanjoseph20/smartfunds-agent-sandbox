# Workflow Recovery Runbook

## Inspect Run
1. `npm run workflow:run-inspect -- --run <runId>`
2. Review `failedNodeIds`, `timedOutNodeIds`, and `firstInspectTarget`.

## Retry Failed Node
1. Verify node is `failed` or `timeout`.
2. `npm run workflow:retry -- --run <runId> --node <nodeId>`
3. Check output fields: `retryAttempt`, `tickDelay`, `scheduled`, `started`.

## Resume Workflow
1. `npm run workflow:resume -- --run <runId>`
2. Confirm output includes:
   - `resumedNodeIds`
   - `skippedCompletedNodeIds`

## Cancel Workflow
1. `npm run workflow:cancel -- --run <runId>`
2. Expected output: `status: "cancelled"`.
3. If already terminal, command fails with `WORKFLOW_ALREADY_TERMINAL`.

## Interpret Trace
1. `npm run workflow:trace -- --run <runId>`
2. Recovery-related entries:
   - `WORKFLOW_RECOVERY_STARTED`
   - `WORKFLOW_RECOVERY_RESUMED`
   - `NODE_RETRY_SCHEDULED`
   - `NODE_RETRY_STARTED`
   - `NODE_TIMEOUT` / `ADAPTER_TIMEOUT`
   - `WORKFLOW_CANCELLED`
