# Mission Control

Sprint 72 introduces the canonical operator control surface for mission lifecycle management.

## Scope in Sprint 72
- CLI is canonical for operator runtime control.
- Slack command bot is an adapter over the same command-router semantics.
- Web UI remains observability-only in this sprint.

## Mission Lifecycle
Operator-facing mission lifecycle states:
- `created`
- `running`
- `completed`
- `failed`
- `cancelled`

These states are projected from journal + runtime observability and mapped from underlying workflow/run states deterministically.

## CLI Commands
Use the canonical operator CLI:

```bash
npm run operator -- mission:start <missionId> [--key value ...]
npm run operator -- mission:list
npm run operator -- mission:inspect <missionId>
npm run operator -- mission:cancel <missionId>
```

Output is deterministic JSON.

## Mission Parameters
`mission:start` accepts granular `--key value` parameters.

Parameter behavior:
- defaults are applied when configured in mission `parameterSchema.defaults`
- provided values override defaults
- required keys in `parameterSchema.required` must be present
- allowed keys in `parameterSchema.allowed` are enforced when configured
- merged parameter object is key-sorted deterministically

Propagation path:
- operator command params
- mission context merge (`initialContext` + `missionParameters`)
- hardened workflow runtime context snapshot memory
- per-node execution context memory in workflow node run envelopes

## Runtime Integration
`mission:start` resolves mission/team/workflow definitions and executes through the hardened workflow runtime path.
It does not use a stub executor and does not bypass runtime enforcement/recovery modules.
