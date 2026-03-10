# Trigger Layer

## Purpose

Sprint 2.5 adds a deterministic trigger layer that converts persisted signals into mission launch requests.

This layer is reaction-only:

- signal emitted and persisted
- matching trigger definitions evaluated
- dedupe checked
- mission launch requests created
- trigger records persisted

It does not execute missions directly.

## Definitions

Trigger definitions live in:

- `control-plane/triggers/definitions/*.json`

Required fields:

- `triggerId`
- `signalType`
- `mission`
- `cooldownSlots`

Definitions are validated strictly and loaded in deterministic `triggerId` order.

## Core Modules

- `control-plane/triggers/trigger-types.ts`
- `control-plane/triggers/trigger-registry.ts`
- `control-plane/triggers/trigger-deduper.ts`
- `control-plane/triggers/trigger-store.ts`
- `control-plane/triggers/trigger-engine.ts`
- `control-plane/triggers/trigger-inspection.ts`

## Signal to Trigger Flow

1. Research runtime emits a signal through `createSignalEmitter().emitSignal(...)`.
2. Signal is validated, normalized, deduplicated, and persisted in `signals/YYYY-MM-DD/signal-log.json`.
3. Trigger engine evaluates persisted signal against matching trigger definitions.
4. For each non-duplicate match, a mission launch request is created.
5. Trigger record is appended to `triggers/YYYY-MM-DD/trigger-log.json`.

The integration seam is passive and failure-safe. Trigger evaluation errors are swallowed to preserve signal/runtime behavior.

## Mission Launch Requests

Trigger engine output shape:

- `status`: `triggered` | `duplicate` | `no_match`
- `launchRequests`: `MissionLaunchRequest[]`

Request shape:

- `missionId`
- `triggerId`
- `sourceSignal`

`sourceSignal` uses signal bus canonical identity `SignalRecord.dedupeKey`.

## Deduplication

Deduplication identity is:

- `triggerId`
- `signalReference` (signal dedupe key)
- `slot`

If the same identity already exists, no new mission launch request is generated and no new trigger record is appended.

## Persistence

Trigger logs are append-only canonical JSON arrays under:

- `triggers/YYYY-MM-DD/trigger-log.json`

Each trigger record includes:

- `triggerId`
- `signalReference`
- `missionLaunched`
- `slot`

## Inspection CLI

- `npm run triggers:list`
- `npm run triggers:inspect -- <triggerId>`
- `npm run triggers:history`

All CLI output is canonical deterministic JSON.
