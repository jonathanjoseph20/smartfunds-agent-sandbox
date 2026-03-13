# Venture Operations

## Scope

This runbook covers Sprint 9.1 Venture Registry operations.

This sprint is deterministic, projection-driven, and descriptive only.

## List Ventures

```bash
npm run ventures:list
```

Returns deterministic venture summaries.

## Inspect Venture

```bash
npm run ventures:inspect -- --venture <ventureId>
```

Returns full venture projection (definition, validation, status, history, summary).

## Venture Status

```bash
npm run ventures:status -- --venture <ventureId>
```

Returns status summary payload for the venture.

## Venture History

```bash
npm run ventures:history -- --venture <ventureId>
```

Returns deterministic append-only history projection.

## Materialize Venture Artifacts

```bash
npm run ventures:materialize -- --venture <ventureId>
```

Writes projection artifacts under `artifacts/ventures/<ventureId>/`:

- `venture-status.json`
- `venture-report.json`
- `venture-report.md`
- `venture-history.json`
- `venture-links.json`
- `venture-summary.json`

## Stable Error Payloads

All commands return canonical JSON and stable errors:

- `VENTURE_NOT_FOUND`
- `INVALID_VENTURE_DEFINITION`
- `MISSING_ARGUMENT`
- `VENTURE_REGISTRY_EMPTY`

## Operational Notes

- venture definitions are loaded from `control-plane/ventures/definitions/`
- projection is semantic truth
- materialized files are persistence artifacts only
- repeated runs with unchanged inputs should produce byte-identical JSON outputs
