# DeFi Intelligence Team Runbook

## Team Purpose

`defi-intelligence` is the persistent Lite-lane research team for continuous DeFi market intelligence.

It operates through scheduler-managed missions grouped by a mission pack.

## Team and Pack

Team definition:

- `control-plane/research/teams/defi-intelligence.json`

Mission pack definition:

- `control-plane/research/packs/defi-intelligence.json`

## Schedules in the Pack

The `defi-intelligence` pack includes:

- `defi-liquidity-hourly-scan`
- `defi-yield-hourly-scan`
- `defi-governance-hourly-scan`
- `defi-daily-market-brief`

The summary trigger schedule is:

- `defi-daily-market-brief`

## Mission Outputs and Team-Owned Storage

Mission outputs are produced under mission/run paths:

- `artifacts/<missionId>/<runId>/...`

Research accumulation copies normalized artifacts to team namespaces:

- `artifacts/defi-intelligence/liquidity-snapshots/...`
- `artifacts/defi-intelligence/yield-snapshots/...`
- `artifacts/defi-intelligence/governance-events/...`
- `artifacts/defi-intelligence/daily-briefs/...`

## Longitudinal Datasets

Datasets are maintained at:

- `artifacts/defi-intelligence/datasets/protocol_tvl_timeseries.json`
- `artifacts/defi-intelligence/datasets/yield_rate_history.json`
- `artifacts/defi-intelligence/datasets/governance_vote_tracker.json`

Accumulation is idempotent by scheduler launch identity (`scheduleId + slotId + runId`).

## Executive Summary Artifacts

Daily synthesis produces:

- `artifacts/defi-intelligence/daily-briefs/defi-daily-intelligence-<reportDate>.json`
- `artifacts/defi-intelligence/daily-briefs/defi-daily-intelligence-<reportDate>.md`
- `artifacts/defi-intelligence/daily-briefs/latest-summary.json`

## Operator Commands

Run scheduler with research runtime processing:

```bash
npm run research:scheduler:tick
```

Dry-run scheduler evaluation:

```bash
npm run research:scheduler:tick -- --dry-run
```

Inspect research teams:

```bash
npm run research:teams:list
npm run research:team:inspect -- --team defi-intelligence
```

Inspect packs:

```bash
npm run research:packs:list
npm run research:pack:inspect -- --pack defi-intelligence
```

Inspect datasets and latest summary:

```bash
npm run research:datasets:inspect -- --team defi-intelligence
npm run research:summary:inspect -- --team defi-intelligence
```

## Expected Daily Workflow

1. Execute scheduler ticks on operational cadence.
2. Accumulate liquidity/yield/governance mission outputs into datasets.
3. Run daily brief schedule.
4. Confirm daily intelligence artifacts were generated.
5. Inspect summary and dataset counts for operator review.

## Scope Guardrails

This runbook covers deterministic persistent research only.

Not included in this sprint:

- signal-triggered runs
- autonomous decision loops
- Slack/dashboards/auth/multi-entity controls
