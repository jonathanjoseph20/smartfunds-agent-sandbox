# Policy Profiles v1 (Foundation)

## Purpose

Sprint A introduces additive policy profile primitives for governance evolution without changing current tier-based CI enforcement.

This sprint is foundation-only:

- No cutover from risk tiers
- No changes to `validate-pr.ts`
- No changes to `risk-contract.json`
- No changes to GitHub workflow enforcement semantics

## Why Add Profiles

Risk tiers classify *change sensitivity* (tier-0 to tier-3), but they do not directly model runtime capability classes or scope constraints for mission execution.

Policy profiles add that runtime-focused contract layer:

- `lite`
- `build`
- `core`

Profiles can constrain:

- Capability classes (`read`, `artifact_write`, `repo_write`, `pr_open`, `protected_write`)
- Scope (repos + path globs)
- Mutation intent (`none`, `artifact`, `code_change`, `governance_change`)

## Architecture Components

### 1) Policy Types

`control-plane/policy/types.ts` defines canonical profile/capability/scope/intent/result types.

### 2) Capability Model

`control-plane/policy/capabilities.ts` defines deterministic allowed capability sets per profile.

### 3) Scope Registry

`control-plane/policy/scope-registry.json` is the profile scope source for the new runtime validation module.

`control-plane/policy/scope-registry.ts` provides:

- strict schema validation
- malformed definition rejection
- deterministic ordering normalization

### 4) Deterministic Profile Validation

`control-plane/policy/profile-validation.ts` validates requests across:

- profile recognition
- capability allowance
- target repo/path scope
- mutation intent

Output remains deterministic:

- sorted `violations`
- sorted `allowedCapabilities`

## Coexistence with Existing Governance

Current governance behavior remains unchanged.

- Tier inference and validation continue as-is
- Existing ownership, evidence, and diagnostics flows continue as-is
- Existing demos and runtime paths continue working when profile fields are absent

## Migration Strategy

Sprint A establishes contracts only.

Planned progression:

1. Sprint A: foundation primitives (this sprint)
2. Sprint B: activate `lite` for non-mutating runtime missions
3. Later sprints: incremental policy-aware runtime and governance integration

No sprint should introduce non-deterministic behavior.
