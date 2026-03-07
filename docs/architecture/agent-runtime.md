# Agent Runtime Layer

## Overview

Sprint 67 activates agent profiles as runtime actors.

Before this layer, agent profiles were inspected and validated but did not directly control task execution.
After this layer, a task may bind to an agent (`task.agent`), and the runtime resolves a deterministic execution envelope, injects agent context, and enforces adapter boundaries before invocation.

## Profile -> Envelope

`control-plane/agents/runtime/agent-envelope.ts` builds an immutable `AgentExecutionEnvelope` from the validated profile shape.

Determinism guarantees:
- stable key ordering via canonical normalization
- stable sorted arrays (`skills`, `allowedTools`)
- no runtime IDs/timestamps
- no mutation of source profile
- frozen envelope output

Tool policy mapping:
- `allowedTools` derives from `toolProfile.allowedAdapters`
- `toolProfile.forbiddenTools` is subtracted
- adapter identifiers use canonical `TaskType` values (`llm`, `repo`, `shell`)

## Runtime Resolution

`control-plane/agents/runtime/agent-runtime.ts` resolves task-level agent bindings.

Flow:
1. parse mission roster from execution metadata (`metadata.agentRoster`) when present
2. resolve task agent deterministically
3. build active agent envelope
4. build deterministic roster envelopes
5. fail with stable `ERR_*` messages when unresolved or missing

Backward compatibility:
- tasks without `task.agent` continue through existing generic execution path
- adapter policy enforcement only runs for resolved agent-bound tasks

## Context Injection

`control-plane/agents/runtime/agent-context.ts` adds optional agent fields to `ExecutionContext`.

Additive context fields:
- `teamId?`
- `activeAgent?`
- `agentEnvelope?`
- `agentRoster?`

Agent injection is performed per task when bound, and context remains deterministic through existing serializer and context cloning utilities.

## Tool Boundary Enforcement

`control-plane/agents/runtime/agent-tools.ts` enforces adapter policy before adapter invocation.

`assertAgentCanUseAdapter(envelope, adapterId)`:
- allows only canonical `TaskType` ids
- throws deterministic `ERR_AGENT_RUNTIME_INVALID` or `ERR_AGENT_TOOL_FORBIDDEN`
- no silent fallback or bypass path

## Journal and Memory Propagation

Agent metadata now propagates through existing task lifecycle payloads:
- `agentId`
- `adapterId`
- context snapshot containing optional agent/team fields

This keeps attribution traceable while preserving existing event ordering and deterministic serialization.

## CLI Inspection

Two additive CLI commands expose runtime state:
- `npm run agent:inspect -- --agent <agentId>`
- `npm run mission:agents -- --mission <missionId>`

Both follow existing JSON-only deterministic CLI output conventions.
