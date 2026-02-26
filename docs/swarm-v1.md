# Swarm Orchestration v1

## Overview

Swarm v1 introduces a deterministic orchestration layer for multi-step financial execution.

It provides:

- Control-plane declared swarms (no inference)
- Deterministic swarm registry
- Deterministic swarm runner
- Deterministic swarm logging
- Adapter registry + mode enforcement
- Integration with ChargeIntent
- No timestamps in identity
- No randomness
- No network I/O in tests

## Architecture Flow

Entity Registry
→ Rail Binding
→ Mode Policy Enforcement
→ Swarm Runner
→ ChargeIntent
→ Settlement Adapter
→ Deterministic Settlement Log

## Determinism Guarantees

- Canonical JSON normalization
- Stable SHA-256 hashing
- Stable runId generation
- Stable entryId generation
- No nondeterministic behavior
- Full governance compatibility

## Execution Modes

Swarm v1 enforces single execution mode per PR:

- structured
- autonomous

Mixed execution modes are blocked by governance.

## Control-Plane Swarms (v1)

Swarms are declared explicitly under `control-plane/swarms/*.json`. They are not inferred from the filesystem.

Rules:

- One swarm maps to exactly one project.
- Swarm `project` must exist in `control-plane/projects/*.json`.
- `parentSwarm` (if present) must exist and share the same project.
- Parent cycles are rejected.
- `executionMode` must be `structured` or `autonomous`.
- Autonomous mode is opt-in for planning/code/PR preparation only; no merge authority is implied.
- No timestamps or nondeterministic fields in hashes or identifiers.

Example:

```json
{
  "swarmId": "dev-team",
  "project": "docs",
  "team": "docs",
  "executionMode": "structured",
  "parentSwarm": "executive-team",
  "members": [
    { "role": "planner", "capabilities": ["plan", "analyze"] },
    { "role": "implementer", "capabilities": ["code"] }
  ]
}
```

## Testing

- Unit tests for registry, log, runner
- Adapter registry + policy tests
- End-to-end Swarm → ChargeIntent integration test
- No filesystem I/O in new tests

---

Swarm v1 establishes the deterministic orchestration layer required before real-world adapter execution.
