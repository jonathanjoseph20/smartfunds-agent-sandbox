# Team Operations

## Scope

This runbook covers Sprint 4.1 Team Registry operations.

This sprint is pre-execution and descriptive only.

## List Teams

```bash
npm run teams:list
```

Returns deterministic team summaries including lifecycle, availability, and readiness.

## Inspect Team

```bash
npm run teams:inspect -- --team <teamId>
```

Returns the full team projection (definition + validation + status + history).

## Team Status

```bash
npm run teams:status -- --team <teamId>
```

Returns status-only payload.

## Team History

```bash
npm run teams:history -- --team <teamId>
```

Returns deterministic append-only history projection.

## Materialize Team Artifacts

```bash
npm run teams:materialize -- --team <teamId>
```

Writes projection artifacts under `artifacts/teams/<teamId>/`:

- `team-status.json`
- `team-report.json`
- `team-report.md`
- `team-history.json`

## Interpreting States

- lifecycle: structural posture (`defined`, `active`, `dormant`, `archived`)
- availability: future assignment posture (`available`, `restricted`, `unavailable`, `manual_only`)
- readiness: structural confidence (`ready`, `partial`, `blocked`, `incomplete`, `inconclusive`)

## Sprint 4.1 Limitations

Explicitly not supported:

- routing decisions
- team assignment engine
- team invocation
- runtime scheduling
- autonomous execution workflows
