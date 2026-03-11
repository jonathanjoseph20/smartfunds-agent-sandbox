# Portfolio Action Orchestration Operations

## Scope

This runbook covers deterministic inspection and artifact materialization for portfolio action orchestration.

This layer is coordination-only and must not be used for execution.

## Commands

List plans:

```bash
npm run action-orchestration:list
```

Inspect plan:

```bash
npm run action-orchestration:inspect -- --plan risk-reduction-plan
```

Status:

```bash
npm run action-orchestration:status -- --plan risk-reduction-plan
```

Links and rationale:

```bash
npm run action-orchestration:links -- --plan risk-reduction-plan
```

Readiness:

```bash
npm run action-orchestration:readiness -- --plan risk-reduction-plan
```

Priority:

```bash
npm run action-orchestration:priority -- --plan risk-reduction-plan
```

History:

```bash
npm run action-orchestration:history -- --plan risk-reduction-plan
```

Materialize artifacts:

```bash
npm run action-orchestration:materialize -- --plan risk-reduction-plan
```

## Artifact Layout

Artifacts are written under:

- `artifacts/action-orchestration/<planId>/action-plan-status.json`
- `artifacts/action-orchestration/<planId>/action-plan-history.json`
- `artifacts/action-orchestration/<planId>/action-plan-report.json`
- `artifacts/action-orchestration/<planId>/action-plan-report.md`

## Operational Checks

1. Confirm deterministic outputs by running same command twice and diffing output.
2. Confirm blocked/conflict plans stay conservative (`blocked` or `inconclusive`).
3. Confirm rationale tokens in links output explain why actions were grouped.
4. Confirm history dedupe prevents duplicate events for identical evaluations.

## Troubleshooting

- `MISSING_ARGUMENT: --plan`
  - Add `-- --plan <planId>` to command invocation.

- `ACTION_PLAN_NOT_FOUND: <id>`
  - Verify plan exists in `control-plane/action-orchestration/definitions`.

- Empty links
  - Inspect `matchingRules` and candidate route/risk fields.

- Unexpected status shifts
  - Compare `status` and `links` outputs; readiness is derived from linked candidate states and blockers.

## Future Compatibility

Execution systems can consume orchestration artifacts later, but must remain separate.

Orchestration remains deterministic coordination and inspection only.
