# Mission Proposal Operations

## Scope

This runbook covers deterministic proposal submission, review, conversion, and materialization.

This layer is proposal-only and does not execute missions.

## Commands

List proposals:

```bash
npm run mission-proposals:list
```

Inspect proposal:

```bash
npm run mission-proposals:inspect -- --proposal <proposalId>
```

Status:

```bash
npm run mission-proposals:status -- --proposal <proposalId>
```

History:

```bash
npm run mission-proposals:history -- --proposal <proposalId>
```

Materialize artifacts:

```bash
npm run mission-proposals:materialize -- --proposal <proposalId>
```

Submit from full JSON:

```bash
npm run mission-proposals:submit -- --proposal-file <path>
```

Submit from definition + parameters:

```bash
npm run mission-proposals:submit -- \
  --definition <proposalType> \
  --template <templateId> \
  --params-file <path> \
  --sources-file <path> \
  --rationale-file <path> \
  --created-by <founder|agent|system> \
  --created-from-kind <action_plan|portfolio_intelligence|market_synthesis|mission|dag|manual> \
  --created-from-id <stableId>
```

Review:

```bash
npm run mission-proposals:review -- \
  --proposal <proposalId> \
  --decision <approved|rejected> \
  --reviewed-by <stableId> \
  --reason-file <path>
```

Convert approved proposal:

```bash
npm run mission-proposals:convert -- --proposal <proposalId>
```

## Operational Checks

1. Verify proposal and approval state before conversion.
2. Confirm conversion outputs mission create/link only.
3. Run conversion twice and confirm idempotent result.
4. Materialize and verify artifact payloads match projection state.

## Diagnose Blocked Conversion

If conversion is blocked, inspect status blockers:

- `conversion_before_approval`
- `template_missing`
- `invalid_parameters`
- `unsupported_source_kind`
- `linked_dag_missing:<id>`
- `conversion_target_missing`

Then inspect history for conversion events:

```bash
npm run mission-proposals:history -- --proposal <proposalId>
```

## Guarantees

- proposal identity is deterministic and stable
- approval/rejection does not alter proposal identity
- repeated conversion is idempotent
- existing mission identities are linked, not duplicated
- no execution semantics are introduced
