# Signal Bus Foundation

## Purpose

Sprint 2.4 introduces a deterministic Signal Bus as a passive event layer for research runtime outputs.

The bus allows missions, dataset analyzers, and synthesis components to publish stable market-condition signals without introducing automation or trigger behavior.

## Passive Scope

Signal Bus responsibilities in this sprint:

- load and validate JSON signal definitions
- validate emitted payloads against definition schemas
- normalize deterministic signal records
- compute deterministic dedupe identities
- persist append-only signal logs
- expose deterministic inspection surfaces

Out of scope until Sprint 2.5:

- signal-to-mission triggers
- autonomous orchestration
- alerts/Slack
- AI interpretation

## Definitions

Definitions are JSON files under:

- `control-plane/signals/definitions/*.json`

Required fields:

- `signalType`
- `description`
- `sourceMission`
- `schema`
- `deduplicationRules`

Current dedupe rule contract is strict and identical across seeded definitions:

- `signalType`
- `dataset`
- `slot`

Schema validation is intentionally narrow and deterministic:

- required key presence
- primitive type checks (`string`, `number`, `boolean`)

## Registry

Registry module:

- `control-plane/signals/signal-registry.ts`

Behavior:

- loads all definitions during initialization
- fails fast on malformed definitions
- rejects duplicate `signalType`
- provides:
  - `getSignalDefinition(signalType)`
  - `listSignalTypes()`
  - `validateSignalPayload(signalType, payload)`

## Emitter

Emitter module:

- `control-plane/signals/signal-emitter.ts`

API:

- `emitSignal(signalType, payload)`

Flow:

1. resolve definition from registry
2. validate payload schema
3. normalize signal record
4. compute deterministic dedupe key from `{ signalType, dataset, slot }`
5. check duplicate against persisted logs
6. append only when unique
7. return deterministic result: `persisted` or `duplicate`

Determinism constraints enforced:

- no random IDs
- no internal wall-clock timestamps
- log partition date derived only from deterministic slot/reportDate input
- stable canonical serialization

## Deduplication

Deduper module:

- `control-plane/signals/signal-deduper.ts`

Canonical dedupe identity:

1. canonical object `{ signalType, dataset, slot }`
2. `canonicalStringify(...)`
3. `sha256(...)`

Metadata is not part of identity.

## Store Layout

Store module:

- `control-plane/signals/signal-store.ts`

Append-only file path:

- `signals/YYYY-MM-DD/signal-log.json`

Signal record shape includes:

- `signalType`
- `sourceMission`
- `dataset`
- optional `artifactReference`
- `metadata`
- `slot`
- `dedupeKey`
- `logDate` (derived)

Store guarantees:

- no historical mutation
- duplicate append prevention
- canonical JSON writes
- deterministic inspection ordering on reads

## CLI Inspection

CLI commands:

- `signals:list`
- `signals:inspect <signalType>`
- `signals:history`

Inspection module:

- `control-plane/signals/signal-inspection.ts`

CLI wrappers:

- `control-plane/cli/signals-list.ts`
- `control-plane/cli/signals-inspect.ts`
- `control-plane/cli/signals-history.ts`

## Runtime Integration

Integration is narrow and passive in `control-plane/research/runtime.ts`:

- evaluate deterministic dataset conditions during launch processing
- emit matching signals through `signalEmitter`
- swallow emitter failures to preserve runtime launch semantics

Scheduler due/launch contracts and result shapes remain unchanged.
