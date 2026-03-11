# Mission Operations

## Scope

This runbook covers deterministic mission registry operations in Sprint 3.1.

Current limitations:

- pre-execution only
- no templates
- no DAGs
- no team invocation
- no permissions workflow

## List Missions

```bash
npm run missions:list
```

Returns ordered summaries with mission ID, type, and derived states.

## Inspect Mission

```bash
npm run missions:inspect -- --mission <missionId>
```

Returns full mission projection.

## Mission Status

```bash
npm run missions:status -- --mission <missionId>
```

Returns status payload only.

## Mission History

```bash
npm run missions:history -- --mission <missionId>
```

Returns append-only mission event history.

## Materialize Mission Artifacts

```bash
npm run missions:materialize -- --mission <missionId>
```

Writes artifacts under `artifacts/missions/<missionId>/`:

- `mission-status.json`
- `mission-report.json`
- `mission-report.md`
- `mission-history.json`

## Diagnose Blocked Missions

1. Inspect status for `blockingReasons`.
2. Inspect history for recent event transitions.
3. Inspect linked object IDs in projection (`linkedActionPlanIds`, `linkedPortfolioIds`, `linkedMarketSynthesisIds`).
4. Re-materialize after upstream state changes and confirm deterministic status output.
