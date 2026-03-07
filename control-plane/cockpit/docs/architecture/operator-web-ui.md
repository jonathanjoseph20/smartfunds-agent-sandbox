# Operator Web UI — Architecture

## Visualization-First Design

The Operator Web UI (cockpit) is a **read-only inspection surface**. It does NOT own runtime state, does NOT execute commands, and does NOT serve as a control plane.

## Why CLI Remains Canonical

All operator commands (mission lifecycle, workflow control, retry/resume/cancel) route through `control-plane/operator/command-router.ts`. The CLI is the canonical interface. The web UI shows command hints but never executes them.

## Why Slack Remains Adapter-Only

Slack commands route through the same `command-router.ts` path as CLI. Slack is an adapter, not an authority.

## Why UI Does Not Own Runtime State

The UI consumes derived, journal-based inspection data. It does not maintain its own state store, cache, or persistence layer. All data flows from canonical operator services through adapters into view models.

## Adapter / View-Model Strategy

```
Operator Services (canonical)
       ↓
   Adapters (normalize + isolate)
       ↓
   View Models (UI-specific shapes)
       ↓
   React Components (render)
```

- **Adapters** (`lib/adapters.ts`): Isolate UI from raw service output. Accept command envelopes, normalize payloads, support mock data for Sprint 73.
- **View Models** (`lib/view-models.ts`): Map service JSON into stable, explicitly-named UI shapes. Field ordering is deterministic. Naming is operator-friendly.
- **Mock Data** (`lib/mock-data.ts`): Deterministic seed data matching known operator contract shapes. No random IDs, no random ordering.

## Data Flow

```
Journal / Observability (source of truth)
       ↓
Operator Services (mission-service, workflow-service, runtime-service)
       ↓
Command Router (CLI / Slack / Internal)
       ↓
Command Envelope { command, payload, success }
       ↓
Cockpit Adapters (normalize envelope + payload)
       ↓
View Models (stable UI shapes)
       ↓
React Pages & Components
```

## Future Wiring

When real operator services are available, replace mock data calls in `adapters.ts` with HTTP/RPC calls to the operator layer. The adapter interface remains stable. View models remain unchanged.
