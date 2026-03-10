# Build Profile v1 Activation

## Scope

Sprint C activates `build` as a real runtime execution lane.

The activation is additive:

- Lite remains active for non-mutating missions.
- Build is now active for bounded code-shipping missions.
- Core is not yet profile-activated as a dedicated runtime lane.
- Tier governance remains authoritative for current governance enforcement.

## Runtime Dispatch

Mission execution now supports explicit profile routing:

- `executeLiteMission()`
- `executeBuildMission()`
- `executeGovernedMission()` (legacy/default path)

`profile=build` routes only to the dedicated Build executor path.

## Build Capability Contract

Build requires and allows:

- `read`
- `artifact_write`
- `repo_write`
- `pr_open`

Build rejects:

- `protected_write`

Deterministic Build errors are emitted for forbidden capabilities, forbidden intents, and denied target scope.

## Scope Boundaries

Build scope enforcement remains registry-driven and conservative for non-Core surfaces:

- `apps/**`
- `dashboard/**`
- `tools/**`
- `docs/**`

Protected/Core-sensitive paths remain out of Build scope.

## Build Execution Flow

Dedicated Build execution performs:

1. profile/capability/scope/intent validation
2. deterministic branch name derivation
3. bounded file mutation in approved scope only
4. staged-file hygiene checks (artifact leakage rejection)
5. commit + push
6. PR open/update
7. machine-generated runtime provenance in PR body
8. run metadata emission (`profile`, `executionPath`, branch/PR data, mutation summary)

## Governance Compatibility

Build PR body generation reuses existing deterministic governance mutation patterns and preserves tier/evidence structure compatibility.

No global CI/workflow cutover is introduced in Sprint C.
