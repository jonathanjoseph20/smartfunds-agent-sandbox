# Mission + Team + Agent Profile Layer (Sprint 66)

## Purpose

Sprint 66 adds a deterministic configuration layer above swarm execution:

Mission
→ Team Definition
→ Granular Agent Profiles
→ Workflow
→ Swarm Runtime

The layer is file-defined, schema-validated, and immutable at runtime.

## Directory Layout

- `control-plane/missions/`
- `control-plane/missions/definitions/`
- `control-plane/teams/`
- `control-plane/teams/definitions/`
- `control-plane/agents/`
- `control-plane/agents/profiles/`

## Contracts

### Mission Contracts

Mission definitions include:

- `missionId`
- `projectId`
- `teamId`
- `workflowId`
- `objective`
- optional context and planning fields

Mission validation rejects missing required contract fields.

### Team Definitions

Team definitions include:

- `teamId`
- `projectId`
- `members`
- `executionMode`

Validation enforces deterministic member sets and rejects duplicates.

### Granular Agent Profiles

Agent profiles include structured sections:

- personality profile
- skills profile
- background profile
- output profile
- constraints profile
- tool profile

Validation enforces adapter compatibility and tool boundary consistency.

## Runtime Integration

`mission-runner` composes existing runtime surfaces:

- mission loader/validator
- team loader/validator
- agent loader/validator
- existing `createSwarmRunner`
- existing execution journal event model

No new orchestration model is introduced.

Mission metadata is seeded into context snapshots and payload metadata using existing event types.

## Determinism Guarantees

- no randomness
- no timestamp- or UUID-based mission identity
- sorted file loading
- deterministic roster ordering
- canonical JSON output for CLI commands
- read-only file configuration inputs

## Governance Compatibility

Ownership entries are declared with prefix-style paths for:

- `control-plane/missions/`
- `control-plane/teams/`
- `control-plane/agents/`

No globstars are required in ownership declarations.
