# Runbook: Core Profile Mapping

## Scope

This runbook explains how to classify Build vs Core boundaries locally and how to debug deterministic boundary failures.

This runbook does not change CI routing or legacy governance merge controls.

## Classify Scope Locally

Use deterministic local scope classification:

```bash
npm run policy:classify-scope -- --repo smartfunds-agent-sandbox --path dashboard/ui/index.html
npm run policy:classify-scope -- --repo smartfunds-agent-sandbox --path control-plane/policy/scope-registry.json
```

Output is deterministic JSON and includes:

- `requiredProfile`
- `reason`
- `coreScopeMatched`
- matched build/core paths
- unmatched paths

## Validate Profile Requests Locally

Validate full profile/capability/intent/scope combinations:

```bash
npm run policy:validate-profile -- --profile build --capability repo_write --capability pr_open --capability read --intent ui_change --repo smartfunds-agent-sandbox --path dashboard/ui/index.html
npm run policy:validate-profile -- --profile build --capability repo_write --capability pr_open --capability read --intent code_change --repo smartfunds-agent-sandbox --path control-plane/policy/scope-registry.json
```

Output includes deterministic validation metadata:

- `requestedProfile`
- `requiredProfile`
- `scopeClassification`
- `coreScopeMatched`
- `coreReasons`
- `violations`

## Define a Core Mission

Mission definitions follow the existing contract in `control-plane/missions/definitions`.

Example Core mission definition:

- `control-plane/missions/definitions/core/core-governance-policy-update.json`

Companion Build-rejected example targeting the same scope:

- `control-plane/missions/definitions/build/build-governance-policy-update-rejected.json`

## Debug Build vs Core Failures

Common deterministic failure codes:

- `BUILD_CANNOT_TARGET_CORE_SCOPE`
- `CORE_MUTATION_INTENT_REQUIRED`
- `PROTECTED_WRITE_REQUIRES_CORE`
- `BUILD_TARGET_SCOPE_DENIED`

Debug workflow:

1. Run `policy:classify-scope` for repo/path input.
2. Run `policy:validate-profile` with mission profile + intent + capabilities.
3. Confirm whether `requiredProfile` is `core` and inspect `coreReasons`.
4. If Build was used against Core scope, either:
   - change mission scope to Build-safe paths, or
   - change mission profile/intent to Core and route through governed path.

## Legacy Governance Status

Even with Core mapping active:

- Tier-based governance remains authoritative for merge gating.
- `validate-pr.ts` behavior is unchanged.
- No global CI cutover is active in this sprint.
