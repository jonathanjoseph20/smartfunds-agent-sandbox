# Mission Activation Operations

## Scope

This runbook covers Sprint 4.4 mission activation readiness operations.

This layer is deterministic and descriptive.

## Evaluate Activation

```bash
npm run mission-activation:evaluate -- --mission <missionId>
```

Optional policy override:

```bash
npm run mission-activation:evaluate -- --mission <missionId> --policy <policyId>
```

## Inspect Activation Decision

```bash
npm run mission-activation:inspect -- --mission <missionId>
```

Returns full activation projection.

## Activation Status

```bash
npm run mission-activation:status -- --mission <missionId>
```

Returns status-only activation payload.

## Activation History

```bash
npm run mission-activation:history -- --mission <missionId>
```

Returns append-only activation history for the current activation decision.

## Materialize Activation Artifacts

```bash
npm run mission-activation:materialize -- --mission <missionId>
```

Writes:

- `activation-status.json`
- `activation-report.json`
- `activation-report.md`
- `activation-history.json`
- `activation-preconditions.json`
- `activation-handoff.json`

## Confirm Activation

```bash
npm run mission-activation:confirm -- --mission <missionId> [--reviewed-by <reviewerId>]
```

Records `activation_confirmed` event.

This does not start runtime execution.

## Reject Activation

```bash
npm run mission-activation:reject -- --mission <missionId> --reason-file <path> [--reviewed-by <reviewerId>]
```

Records `activation_rejected` event.

## Troubleshooting Readiness

1. Inspect activation status and `executionReadinessState`.
2. Review `preconditionResults` for non-satisfied states.
3. Review `blockingReasons` and `limitations`.
4. Validate assignment and DAG states upstream.
5. Confirm no runtime artifacts are created by this layer.

## Command Reference

- `mission-activation:list`
- `mission-activation:inspect -- --mission <missionId>`
- `mission-activation:status -- --mission <missionId>`
- `mission-activation:history -- --mission <missionId>`
- `mission-activation:materialize -- --mission <missionId>`
- `mission-activation:evaluate -- --mission <missionId> [--policy <policyId>]`
- `mission-activation:confirm -- --mission <missionId> [--reviewed-by <reviewerId>] [--policy <policyId>]`
- `mission-activation:reject -- --mission <missionId> --reason-file <path> [--reviewed-by <reviewerId>] [--policy <policyId>]`

## Sprint 4.4 Boundaries

Not supported:

- mission runtime execution
- team invocation
- scheduler enqueueing
- runtime retries/timeouts
