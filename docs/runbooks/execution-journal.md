# Execution Journal Runbook

## Create a Run

```bash
npm run journal:create -- --project control-plane --kind governance --entrypoint governance:preflight
```

Expected output: JSON run metadata including `runId`.

## Append an Event

```bash
npm run journal:event -- --run run_control-plane_0001 --type PHASE_STARTED --phase plan --payload '{"step":"begin"}'
```

Optional:

- `--task <taskId>`

Expected output: JSON event object with deterministic `eventId` and `sequence`.

## Inspect a Run

```bash
npm run journal:inspect -- --run run_control-plane_0001
```

Expected output: JSON object with:

- `run`
- ordered `events`

## Summarize a Run

```bash
npm run journal:summary -- --run run_control-plane_0001
```

Expected output: reducer-derived `RunSummary` JSON.

## Debugging Corrupted Journal Data

Symptoms:

- sequence validation failures
- run not found errors
- reducer ordering errors

Checks:

1. Confirm run metadata exists at `runtime-data/journal/runs/<runId>.json`.
2. Confirm events file exists at `runtime-data/journal/events/<runId>.json`.
3. Confirm event `sequence` values are contiguous starting at `1`.
4. Confirm JSON is valid and LF-terminated.

Recovery guidance:

- Treat journal files as append-only.
- Do not mutate historical events in place.
- If corruption occurred, archive the bad files and recreate the run cleanly.
