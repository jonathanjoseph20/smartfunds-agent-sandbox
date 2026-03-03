# Workflow Integrity

## Symptom

- Workflow integrity job fails.
- `npm run lint:workflows` reports parse, missing entrypoint, or disallowed entrypoint errors.

## Why It Happens

Guardrails enforce:

- workflow YAML must parse
- node-invoked `.ts/.js` entrypoints in workflow `run` steps must exist
- node entrypoints must be on the canonical allowlist

## Exact Fix Commands

```bash
npm run lint:workflows
```

If missing file:

```bash
# update workflow run command to an existing entrypoint
# or add the required entrypoint file
```

If disallowed file:

```bash
# switch workflow command to canonical entrypoint
# current allowlist:
# - control-plane/validate-pr.ts
# - control-plane/cli/governance-emit-ci.ts
```

## Success Looks Like

- `npm run lint:workflows` prints `Workflow integrity OK. Files checked: <n>`.
- Governance Full `workflow_integrity` job passes before `policy_full`.
