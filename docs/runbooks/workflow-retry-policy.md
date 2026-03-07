# Workflow Retry Policy

## Retryable Failure Types
- `ADAPTER_EXECUTION_FAILED`
- `TOOL_TIMEOUT`
- `TASK_RESULT_INVALID`
- `NODE_TIMEOUT`
- `ADAPTER_TIMEOUT`
- `WORKFLOW_TIMEOUT`

## Deterministic Schedule
- Attempt 1 -> `tickDelay=0`
- Attempt 2 -> `tickDelay=1`
- Attempt 3 -> `tickDelay=2`

The scheduler is tick-based and deterministic.

Retries are enforced in live execution through the hardened canonical workflow runner path.

## Exhaustion Behavior
- Per-node retries stop after `maxRetriesPerNode`.
- Runtime emits `NODE_RETRY_EXHAUSTED` when no retries remain.
- Exhausted retries transition deterministically to terminal workflow failure.

## Total Retry Guardrail
- Workflow-wide retries are constrained by `maxTotalRetriesPerWorkflow`.
- Violations are surfaced as `SAFETY_LIMIT_VIOLATION`.

## Timeout Interaction
- Timeouts map to retryable failure classes (`NODE_TIMEOUT`, `ADAPTER_TIMEOUT`, `WORKFLOW_TIMEOUT`) and are evaluated by policy.
- Timeout and retry are both journaled for replay and diagnostics.
- Timeout-triggered retries follow the same deterministic scheduler and projection path (`NODE_TIMEOUT`/`ADAPTER_TIMEOUT` -> `NODE_RETRY_SCHEDULED` -> `NODE_RETRY_STARTED`).
