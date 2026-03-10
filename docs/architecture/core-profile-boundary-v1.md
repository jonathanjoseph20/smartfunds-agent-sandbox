# Core Profile Boundary v1

## Purpose

Sprint D establishes Core as an explicit mapped boundary in the profile policy model.

This sprint is boundary mapping and enforcement only:

- Lite remains active for artifact-only work.
- Build remains active for bounded mutation in Build-safe scope.
- Core is now explicitly mapped for protected scope/capability/intent classification.
- Legacy tier governance remains the authoritative merge gate for Core-sensitive changes.

## What Core Means

Core indicates mutation risk to governance/control-plane integrity, protected infrastructure, runtime integrity, entity/financial registries, or equivalent protected system posture.

Core is determined deterministically from:

- target scope registry matching
- mutation intent class
- requested capability class

## Scope Mapping (v1)

Source of truth:

- `control-plane/policy/scope-registry.json`

Build-safe scope remains conservative and includes:

- `dashboard/**`
- `docs/**`
- `apps/**`

Core-only mapped scope includes:

- `control-plane/**`
- `entities/**`
- `runtime/**`
- `governance/**`
- `packages/**`
- `scripts/**`
- `.github/workflows/**`

If a requested scope is unmapped, classification defaults to Core conservatively.

## Deterministic Classification Model

`control-plane/policy/core-classification.ts` provides deterministic policy decisions for:

- scope classification (`build` or `core` requirement)
- mutation intent requirement (`lite`/`build`/`core`)
- capability requirement (`lite`/`build`/`core`)
- aggregate required profile

Build/Core separation is machine-enforced through `profile-validation` and `operator/profile-policy`.

## Runtime Behavior

Build requests are rejected deterministically when any classification requires Core, including:

- Core scope overlap
- Core-only mutation intent
- Core-only capability (`protected_write`)

Stable profile-policy error codes are emitted for boundary denials.

## Runtime Metadata

Mission run outputs now include profile classification metadata:

- `requestedProfile`
- `requiredProfile`
- `scopeClassification`
- `coreScopeMatched`
- `coreReasons`

This metadata is emitted in mission response payloads and `run-metadata.json` artifacts.

## Relationship to Tier Governance

This sprint does not replace or remove tier governance.

- Tier labels remain required.
- Evidence blocks remain required.
- Existing `validate-pr.ts` governance remains authoritative for merge gating.

Core mapping v1 is a prerequisite for Sprint E cutover work, not the cutover itself.
