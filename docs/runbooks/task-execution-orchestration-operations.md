# Task Execution Orchestration Operations

## Inspect Orchestration State

Use task graph scoped commands:

- `npm run task-execution:orchestration-status -- --graph <taskGraphId>`
- `npm run task-execution:assignments -- --graph <taskGraphId>`
- `npm run task-execution:queues -- --graph <taskGraphId>`
- `npm run task-execution:deferrals -- --graph <taskGraphId>`
- `npm run task-execution:orchestration-history -- --graph <taskGraphId>`

All outputs are JSON only and deterministically ordered.

## Run Orchestration Cycles

Single cycle:

- `npm run task-execution:cycle -- --graph <taskGraphId> [--policy <policyId>]`

Multiple cycles:

- `npm run task-execution:orchestrate -- --graph <taskGraphId> [--policy <policyId>] [--max-cycles <n>]`

Assignment-only entrypoint:

- `npm run task-execution:assign -- --graph <taskGraphId> [--policy <policyId>]`

## Interpret Deferrals

Common reason tokens:

- `no_compatible_worker`: no worker matched task type/capability constraints.
- `no_capacity`: compatible workers were active but at capacity.
- `worker_disabled`: compatible workers are disabled.
- `worker_paused`: compatible workers are paused.
- `worker_unavailable`: compatible workers not currently assignable.
- `deterministic_ordering_deferred`: deferred due to deterministic cycle ordering/cycle cap.

## Read Worker Queues

Queue summary per worker includes:

- `totalQueued`
- `inFlight`
- `completed`
- `remainingCapacity`

Queue entries progress through `queued -> claimed -> running -> completed|failed` based on claim/result events.

## Debug Assignment Behavior

1. Inspect latest cycle and assignment decisions.
2. Check `deferralReasonTokens` and compatibility summaries.
3. Verify worker status (`active|paused|disabled`) and `maxConcurrentAssignments` in worker definitions.
4. Confirm task execution history has expected claim/result transitions.
5. Materialize artifacts under `artifacts/task-execution/<executionRunId>/` for immutable snapshots.
