# Runbook: Policy Profiles Foundation (Sprint A)

## Scope

This runbook covers the additive policy profile foundation introduced in Sprint A.

It does **not** change existing tier-based governance behavior.

## Mission Declaration (Optional Fields)

Mission definitions can now include optional policy fields:

- `profile`
- `mutationIntent`
- `requestedCapabilities`
- `targetScope`

Example:

```json
{
  "missionId": "rwa-market-analysis",
  "projectId": "smartfunds-core",
  "teamId": "smartfunds-research-team",
  "workflowId": "research-analysis-workflow",
  "objective": "Analyze near-term tokenized RWA opportunities.",
  "successCriteria": ["Produce market landscape summary"],
  "deliverables": ["market-summary"],
  "initialContext": {},
  "profile": "build",
  "mutationIntent": "code_change",
  "requestedCapabilities": ["read", "repo_write"],
  "targetScope": {
    "repo": "smartfunds-agent-sandbox",
    "paths": ["apps/**", "tools/**"]
  }
}
```

These fields are optional and backward-compatible.

## Local Validation

Run targeted profile foundation tests:

```bash
npx vitest control-plane/policy/profile-validation.test.ts control-plane/policy/scope-registry.test.ts control-plane/missions/mission-validator.test.ts
```

## Registry Maintenance

Profile scopes are defined in:

- `control-plane/policy/scope-registry.json`

Validation and deterministic normalization are enforced by:

- `control-plane/policy/scope-registry.ts`

Rejected examples include:

- duplicate repos in `allowedRepos`
- duplicate path globs in per-repo path lists
- invalid path patterns (for example containing `..`)

## Coexistence with Tier System

The policy profile model currently coexists with the existing tier model:

- Tiers remain authoritative for CI governance checks
- Profile validation is runtime contract foundation only
- No tier enforcement or PR governance semantics are modified in Sprint A
