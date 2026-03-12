# Execution Contract Operations

## Scope

This runbook covers Sprint 5.1 execution contract operations.

This layer is deterministic, additive, and pre-execution only.

## Evaluate Execution Contract

```bash
npm run execution-contract:evaluate -- --mission <missionId>
```

Optional policy override:

```bash
npm run execution-contract:evaluate -- --mission <missionId> --policy <policyId>
```

## Inspect Execution Contract

```bash
npm run execution-contract:inspect -- --mission <missionId>
```

Returns full execution contract projection.

## Execution Contract Status

```bash
npm run execution-contract:status -- --mission <missionId>
```

Returns status-only execution contract payload.

## Execution Contract History

```bash
npm run execution-contract:history -- --mission <missionId>
```

Returns append-only history for the current execution contract.

## Materialize Execution Contract Artifacts

```bash
npm run execution-contract:materialize -- --mission <missionId>
```

Writes:

- `execution-contract-status.json`
- `execution-contract-report.json`
- `execution-contract-report.md`
- `execution-contract-history.json`
- `execution-contract-preconditions.json`
- `execution-runtime-envelope.json`

## Confirm Execution Contract

```bash
npm run execution-contract:confirm -- --mission <missionId> [--reviewed-by <reviewerId>]
```

Records `execution_contract_confirmed` event.

This does not invoke runtime.

## Reject Execution Contract

```bash
npm run execution-contract:reject -- --mission <missionId> --reason-file <path> [--reviewed-by <reviewerId>]
```

Records `execution_contract_rejected` event.

## Troubleshooting Runtime Handoff Readiness

1. Inspect execution contract status and `executionEligibilityState`.
2. Review `preconditionResults` for non-satisfied states.
3. Review `remainingBlockers` and `limitations`.
4. Validate assignment and activation states upstream.
5. Confirm no runtime artifacts are created by this layer.

## Command Reference

- `execution-contract:list`
- `execution-contract:inspect -- --mission <missionId>`
- `execution-contract:status -- --mission <missionId>`
- `execution-contract:history -- --mission <missionId>`
- `execution-contract:materialize -- --mission <missionId>`
- `execution-contract:evaluate -- --mission <missionId> [--policy <policyId>]`
- `execution-contract:confirm -- --mission <missionId> [--reviewed-by <reviewerId>] [--policy <policyId>]`
- `execution-contract:reject -- --mission <missionId> --reason-file <path> [--reviewed-by <reviewerId>] [--policy <policyId>]`

## Sprint 5.1 Boundaries

Not supported:

- mission runtime execution
- team runtime invocation
- scheduler enqueueing
- runtime retry logic
- external runtime integrations
