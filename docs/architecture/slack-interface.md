# Slack Mission Control Interface

## Scope

Sprint 80 adds a Slack operator interface as an external control surface. It does not modify runtime execution determinism.

## Architecture

Flow:

1. Slack command (`/mission` or `/artifact`)
2. `runtime/slack/slack-events.ts`
3. `runtime/slack/slack-router.ts`
4. `runtime/mission/mission-controller.ts`
5. `control-plane/operator` mission/workflow services

Runtime workflow execution remains unchanged. Slack only orchestrates service calls and message delivery.

## Components

- `runtime/slack/slack-gateway.ts`
  - Lazy-loads `@slack/bolt`
  - Starts Socket Mode app
  - Registers handlers
- `runtime/slack/slack-events.ts`
  - Handles slash commands, action hooks, message action hooks
- `runtime/slack/slack-router.ts`
  - Parses subcommands and routes to mission controller
  - Returns deterministic structured errors
- `runtime/slack/slack-client.ts`
  - Wraps Slack API calls (`chat.postMessage`, `chat.postEphemeral`, `files.upload`)
- `runtime/slack/slack-format.ts`
  - Block Kit-style deterministic message builders
- `runtime/slack/slack-notifier.ts`
  - Lifecycle notification sender
- `runtime/mission/mission-controller.ts`
  - Thin wrapper over `control-plane/operator/mission-service.ts` and `workflow-service.ts`

## Determinism Guardrails

- No direct workflow engine mutation.
- No random IDs or runtime hash changes.
- Slack responses are deterministic and derived from service outputs.
- Artifact retrieval is defensive and read-only from `./artifacts`.

## Reference

For Sprint 81 operational hardening details, see `docs/architecture/slack-operator-layer.md`.
