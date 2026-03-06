# Swarm Execution Engine (Sprint 63)

## Purpose

The Swarm Execution Engine is the deterministic runtime orchestration layer between governance/journal infrastructure and future agent-runtime execution.

It is responsible for:

- creating deterministic swarm runs from canonical project metadata
- executing fixed phases in strict sequence
- executing phase tasks in stable order
- emitting append-only lifecycle events to the Execution Journal
- deriving runtime state by replaying journal events

## Layering

Governance Layer
→ Canonical Project Registry
→ Execution Journal
→ Swarm Execution Engine
→ Agent Runtime (future)
→ Interface Layer

Sprint 63 introduces only the Swarm Execution Engine behavior.

## Canonical Phase Model

Phases are fixed and ordered:

1. plan
2. setup
3. implement
4. verify
5. test
6. release

No phase skipping or reordering is allowed.

## Event Model

The engine emits lifecycle events through the existing journal contract:

- RUN_CREATED
- PHASE_STARTED
- TASK_STARTED
- TASK_COMPLETED
- TASK_FAILED
- PHASE_COMPLETED
- RUN_COMPLETED
- RUN_FAILED

Event order is deterministic and sequence-based.

## Source of Truth

Execution Journal is authoritative.

- Run metadata is resolved from canonical registry (`entities/projects/*.json`) at run creation.
- Runtime status is derived from journal replay, not hidden mutable state.
- The swarm runner can re-derive run status repeatedly with stable output.

## Determinism Constraints

Sprint 63 implementation enforces:

- no UUIDs
- no randomness
- no timestamps for identity/order
- stable task sorting (`order`, then `taskId`)
- strict phase sequencing
- stable JSON output from CLIs

## Single-Process Scope

Implementation is intentionally single-process and serial.

- one run executes one phase at a time
- one phase executes one task at a time
- phase execution stops on first task failure

This keeps behavior auditable and predictable.

## Out of Scope (Sprint 63)

- model/tool invocation
- agent autonomy/planning
- distributed/concurrent execution
- Slack/web UI integration
- governance contract redesign
