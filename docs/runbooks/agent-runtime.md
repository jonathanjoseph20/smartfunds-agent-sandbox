# Agent Runtime Runbook

## Designing Runtime-Effective Agent Profiles

Agent runtime behavior is driven by existing profile fields:
- `personalityProfile`
- `skillsProfile`
- `backgroundProfile`
- `outputProfile`
- `constraintsProfile`
- `toolProfile` (`allowedAdapters`, `forbiddenTools`)

Profiles remain configuration artifacts. Runtime envelopes are deterministic projections of those profiles.

## Binding Tasks to Agents

Task definitions may set:

```json
{
  "taskId": "research",
  "agent": "macro-signal-analyst"
}
```

Behavior:
- if `task.agent` is absent: legacy execution path (no policy enforcement)
- if `task.agent` is present: runtime resolves agent envelope and enforces tool boundaries before adapter execution

## Allowed vs Forbidden Adapters

Adapter policy is evaluated against canonical adapter IDs:
- `llm`
- `repo`
- `shell`

Rules:
- adapter in `allowedAdapters` and not in `forbiddenTools` -> allowed
- otherwise -> deterministic pre-invocation failure

Common errors:
- `ERR_AGENT_NOT_FOUND`
- `ERR_TASK_AGENT_UNRESOLVED`
- `ERR_AGENT_TOOL_FORBIDDEN`
- `ERR_AGENT_RUNTIME_INVALID`

## Inspecting Runtime State

Inspect one agent:

```bash
npm run agent:inspect -- --agent lead-thesis-architect
```

Inspect mission roster envelopes:

```bash
npm run mission:agents -- --mission rwa-market-analysis
```

Both commands return deterministic JSON suitable for CI assertions.

## Deterministic Troubleshooting

1. Verify agent exists in profile registry and matches exact `agentId`.
2. Verify mission/team roster includes the task-bound agent when roster metadata is present.
3. Verify adapter is in `allowedAdapters` and not in `forbiddenTools`.
4. Re-run command and compare JSON output; ordering is stable and should not drift between runs.
