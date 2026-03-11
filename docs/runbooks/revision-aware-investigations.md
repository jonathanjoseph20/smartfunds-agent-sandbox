# Revision-Aware Investigations Runbook

## Purpose

Use this runbook to inspect investigation revision history, deltas, and continuity without re-reading full reports.

## Commands

List revision history:

```bash
npm run investigations:revisions -- --investigation <investigationRunId>
```

Inspect latest delta:

```bash
npm run investigations:delta -- --investigation <investigationRunId>
```

Inspect confidence trend:

```bash
npm run investigations:trend -- --investigation <investigationRunId>
```

Inspect continuity summary:

```bash
npm run investigations:summary -- --investigation <investigationRunId>
```

## How To Read Outputs

`investigations:revisions`:
- revision number ordering
- report reference
- snapshot/delta/continuity artifact paths

`investigations:delta`:
- deterministic per-finding change classification
- what changed since previous revision

`investigations:trend`:
- report confidence direction (`improving`/`degrading`/`flat`/`mixed`)

`investigations:summary`:
- continuity state (`stable`/`evolving`/`inconclusive`/`materially_changed`)
- confidence trend
- unresolved limitations
- revision count

## Artifact Inspection

Revision artifacts live at:

`artifacts/investigations/<investigationRunId>/revisions/`

Each revision folder contains:
- `revision-summary.json`
- `revision-summary.md`
- `findings-snapshot.json`
- `confidence-snapshot.json`
- `delta.json`
- `continuity-summary.json`

## Operator Workflow

1. Run `investigations:revisions` to confirm revision history length and ordering.
2. Run `investigations:delta` to see what changed in the latest cycle.
3. Run `investigations:trend` to assess confidence direction.
4. Run `investigations:summary` to classify continuity and limitations.

This enables deterministic continuity inspection now and prepares inputs for future synthesis layers without adding orchestration in this sprint.
