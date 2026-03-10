# Runbook: Build Profile Operations

## Status

- Lite: active
- Build: active
- Core profile lane: not yet active
- Tier governance: retained and required

This runbook documents Build lane operations for Sprint C activation.

## Run a Build Mission

```bash
npm run mission:build -- --mission dashboard-copy-refresh
```

Expected output includes:

- Mission ID
- Profile (`build`)
- Execution Path (`build`)
- Run ID
- Branch name
- PR number/URL (when available)
- Status
- Artifact count

## Inspect Build Run Metadata

```bash
npm run runs:list
npm run artifacts:view -- --run <run-id>
```

Build run metadata includes:

- `profile=build`
- `executionPath=build`
- `branchName`
- `prNumber` / `prUrl`
- `artifactCount`
- `mutationSummary`

## Build Mission Contract

Build missions must include:

- `profile: "build"`
- `requestedCapabilities` with `repo_write` and `pr_open`
- `targetScope` repo + conservative path globs
- Build-safe `mutationIntent` (for example `code_change`, `ui_change`, `product_update`, `tooling_change`)

Build missions must not request `protected_write`.

## Artifact Leakage Safeguards

Build staged-file hygiene rejects runtime artifact leakage, including:

- `artifacts/**`
- `.tmp/**`
- `runtime-data/**`
- runtime metadata files such as `run-metadata.json`

If leakage is detected, Build execution fails deterministically before commit.

## Governance Notes

Build activation does not remove or replace:

- tier labels
- evidence blocks
- `validate-pr.ts`
- legacy governed/default runtime path

Core boundary activation is deferred to later sprints.
