# Operator Runtime API

Sprint 74 adds a canonical runtime HTTP API at `control-plane/service/`.

## Architecture

- Clients: CLI, Slack adapter, Cockpit UI
- API: `control-plane/service/server.ts` + `control-plane/service/app.ts`
- Services: existing operator mission/workflow/runtime services
- Engine: existing mission, workflow, runtime hardening, observability modules

## Determinism Guarantees

- Stable envelope format for success and errors
- Stable `meta` block: `source=operator-runtime-api`, `version=v1`
- Deterministic request ids using a local sequence counter
- No additional runtime state store introduced

## Client Adapters

- CLI and operator command router now use `control-plane/cli/api-client.ts`
- Slack command router remains an adapter and routes commands through operator router
- Cockpit integration target is runtime API endpoints (`/missions`, `/runs`, `/workflows`)

## CORS

CORS is centrally handled in runtime middleware path (`app.ts`) and is config-driven via `SMARTFUNDS_CORS_ORIGIN`.
