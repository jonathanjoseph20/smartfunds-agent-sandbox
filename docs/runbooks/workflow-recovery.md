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
3. Resume now re-enters hardened runtime execution (`runWorkflowWithHardening`) using journal-reconstructed state.
4. Completed nodes are not re-executed; only failed/remaining nodes continue in deterministic order.

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

## Operational Checks During Recovery
1. Confirm `WORKFLOW_RECOVERY_STARTED` and `WORKFLOW_RECOVERY_RESUMED` are appended before resumed node execution.
2. Verify resumed trace does not include `NODE_STARTED` for already completed nodes.
3. Verify retry/timeout/safety events are present if enforcement is triggered after resume.
