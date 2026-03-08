# Tool Adapters

Sprint 76 introduces a dedicated tool adapter layer for external research inputs.

## Scope

The canonical adapters are:

- `web_search`
- `web_fetch`
- `twitter_search`

These are implemented in `packages/tool-adapters/` and normalized to deterministic structured outputs.

## Contract

All adapters implement:

```ts
export interface ToolAdapter<Request, Result> {
  readonly toolId: string
  execute(request: Request): Promise<Result>
}
```

## Runtime Integration

Workflow nodes using `task` IDs `web_search`, `web_fetch`, `twitter_search`, or `llm_synthesis` are handled directly by the workflow executor path.
Other workflow task IDs continue through the existing swarm runtime path unchanged.

## Determinism

- output URLs are normalized and de-duplicated
- result order is stable and rank-assigned deterministically
- tests use injected/mocked network responses
- default mission/runtime paths remain unchanged unless live missions opt in
