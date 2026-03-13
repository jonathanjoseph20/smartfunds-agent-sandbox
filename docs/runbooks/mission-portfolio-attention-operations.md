# Mission Portfolio Attention Operations

## Purpose

Operate deterministic portfolio attention, escalation, and append-only operator actions.

## Inspect Attention State

List attention queue:

```bash
npm run mission-control:portfolio-attention-queue
```

Inspect attention status:

```bash
npm run mission-control:portfolio-attention-status -- --portfolio <missionPortfolioId>
```

Inspect attention requirements:

```bash
npm run mission-control:portfolio-attention-requirements -- --portfolio <missionPortfolioId>
```

Inspect escalations:

```bash
npm run mission-control:portfolio-escalations -- --portfolio <missionPortfolioId>
```

Inspect action history/outcome:

```bash
npm run mission-control:portfolio-action-history -- --portfolio <missionPortfolioId>
npm run mission-control:portfolio-action-outcome -- --portfolio <missionPortfolioId>
```

## Record Append-Only Operator Actions

Acknowledge:

```bash
npm run mission-control:portfolio-acknowledge -- --portfolio <missionPortfolioId> --by operator --reason acknowledged
```

Defer:

```bash
npm run mission-control:portfolio-defer -- --portfolio <missionPortfolioId> --by operator --reason deferred
```

Escalate:

```bash
npm run mission-control:portfolio-escalate -- --portfolio <missionPortfolioId> --by operator --reason escalated
```

Force review:

```bash
npm run mission-control:portfolio-force-review -- --portfolio <missionPortfolioId> --by operator --reason force_review
```

Suppress:

```bash
npm run mission-control:portfolio-suppress -- --portfolio <missionPortfolioId> --by operator --reason suppressed
```

These commands append attention/action history events only.
They do not mutate mission portfolio coordination truth.

## Materialize Artifacts

```bash
npm run mission-control:portfolio-attention-materialize -- --portfolio <missionPortfolioId>
```

Artifacts are written to:

- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-attention-status.json`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-attention-queue.json`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-escalations.json`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-action-history.json`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-action-outcome.json`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-attention-report.json`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-attention-report.md`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-attention-requirements.json`

## Deterministic Replay Guarantees

1. Repeat inspect commands for the same portfolio and compare JSON output.
2. Repeat action replay inspection and verify identical ordering.
3. Materialize twice and compare byte content for all artifacts.
4. Confirm upstream mission portfolio projection output is unchanged.
