# Mission Portfolio Resolution Operations

## Purpose

Operate deterministic mission portfolio resolution, stabilization, closure eligibility, and closure lifecycle.

## Inspect Resolution State

List resolution queue:

```bash
npm run mission-control:portfolio-resolution-queue
```

Inspect stabilization:

```bash
npm run mission-control:portfolio-stabilization -- --portfolio <missionPortfolioId>
```

Inspect resolution status:

```bash
npm run mission-control:portfolio-resolution-status -- --portfolio <missionPortfolioId>
```

Inspect closure eligibility:

```bash
npm run mission-control:portfolio-closure-eligibility -- --portfolio <missionPortfolioId>
```

Inspect closure state:

```bash
npm run mission-control:portfolio-closure-state -- --portfolio <missionPortfolioId>
```

Inspect resolution action history/outcome:

```bash
npm run mission-control:portfolio-resolution-action-history -- --portfolio <missionPortfolioId>
npm run mission-control:portfolio-resolution-outcome -- --portfolio <missionPortfolioId>
```

## Record Append-Only Resolution Actions

Mark stable:

```bash
npm run mission-control:portfolio-mark-stable -- --portfolio <missionPortfolioId> --by operator --reason mark_stable
```

Mark resolved:

```bash
npm run mission-control:portfolio-mark-resolved -- --portfolio <missionPortfolioId> --by operator --reason mark_resolved
```

Request resolution review:

```bash
npm run mission-control:portfolio-request-resolution-review -- --portfolio <missionPortfolioId> --by operator --reason review_requested
```

Defer closure:

```bash
npm run mission-control:portfolio-defer-closure -- --portfolio <missionPortfolioId> --by operator --reason defer_closure
```

Close:

```bash
npm run mission-control:portfolio-close -- --portfolio <missionPortfolioId> --by operator --reason close
```

Reopen:

```bash
npm run mission-control:portfolio-reopen -- --portfolio <missionPortfolioId> --by operator --reason reopen
```

Archive:

```bash
npm run mission-control:portfolio-archive -- --portfolio <missionPortfolioId> --by operator --reason archive
```

These commands append resolution history events only.
They do not mutate upstream mission portfolio coordination or attention truth.

## Materialize Resolution Artifacts

```bash
npm run mission-control:portfolio-resolution-materialize -- --portfolio <missionPortfolioId>
```

Artifacts written:

- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-stabilization.json`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-resolution-status.json`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-closure-eligibility.json`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-resolution-queue.json`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-resolution-action-history.json`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-closure-state.json`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-resolution-outcome.json`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-resolution-report.json`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-resolution-report.md`

## Replay and Determinism Checks

1. Repeat inspect commands and verify identical JSON output for the same input.
2. Repeat materialization twice and compare file content bytes.
3. Verify action history dedupe by issuing identical action payloads and confirming no duplicate event insertion.
4. Confirm upstream attention/portfolio projection output remains unchanged.
