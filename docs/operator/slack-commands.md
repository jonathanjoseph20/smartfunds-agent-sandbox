# Slack Commands

Sprint 72 Slack support is command-bot style and adapter-only.
Slack does not execute runtime controls directly.

## Adapter Flow
- Slack slash text input
- Slack adapter parsing
- operator command-router
- mission/workflow/runtime services
- deterministic JSON-backed Slack response payload

## Supported Forms
- `/mission start <missionId> [--key value ...]`
- `/mission list`
- `/mission inspect <missionId>`
- `/mission cancel <missionId>`
- `/workflow list`
- `/workflow inspect <runId>`
- `/workflow trace <runId>`
- `/workflow retry --run <runId> --node <nodeId>`
- `/workflow resume --run <runId>`
- `/workflow cancel --run <runId>`

## Determinism Notes
- Slack command payloads are mapped to the same canonical router command argv.
- Router validation and error semantics are shared with CLI.
- Response payloads are deterministic JSON-backed structures.

## Sprint Boundary
Web UI controls are not part of Sprint 72.
Workflow control remains CLI/Slack-router mediated.
