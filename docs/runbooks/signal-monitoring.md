# Signal Monitoring Runbook

## Overview

Signal Bus logs deterministic market-condition signals emitted by research runtime processing.

This layer is passive:

- it records signals
- it does not trigger missions

## Emission Path

Signals are emitted from deterministic runtime conditions (for example dataset rows indicating TVL spikes, yield anomalies, governance events, or protocol risk).

Emission API:

- `emitSignal(signalType, payload)`

Emitter validates:

- definition exists
- payload schema keys and primitive types
- deterministic date derivation from slot/reportDate

If deterministic date cannot be derived, emission fails with stable error `SIGNAL_MISSING_DETERMINISTIC_DATE`.

## Log Locations

Signal logs are persisted under:

- `signals/YYYY-MM-DD/signal-log.json`

Examples:

- `signals/2026-03-10/signal-log.json`
- `signals/2026-03-11/signal-log.json`

## Inspection Commands

List recent signals:

```bash
npm run signals:list
```

List recent signals with cap:

```bash
npm run signals:list -- --limit 25
```

Inspect one type:

```bash
npm run signals:inspect -- tvl_spike
```

Show grouped history:

```bash
npm run signals:history
```

All CLI outputs are deterministic canonical JSON.

## Duplicate Behavior

Signals are deduplicated by deterministic identity:

- `signalType`
- `dataset`
- `slot`

Duplicate outcomes:

- no additional write
- no additional append
- deterministic result status `duplicate`

## Debugging Missing Signals Deterministically

1. Validate the definition exists and is well-formed in `control-plane/signals/definitions/`.
2. Confirm payload has required schema keys and primitive types.
3. Confirm payload includes deterministic `slot` and an extractable `YYYY-MM-DD`, or explicit `reportDate`.
4. Compute expected dedupe identity from `{ signalType, dataset, slot }`.
5. Check if matching `dedupeKey` already exists in historical logs.
6. Confirm runtime dataset row contains deterministic fields required by signal rule.

## Sprint Boundary

Current sprint intentionally excludes:

- signal-triggered missions
- external alerts
- Slack integration
- AI interpretation

Trigger orchestration is planned for Sprint 2.5.
