# Mission Portfolio Operations

## Scope

This runbook covers deterministic inspection and materialization for Mission Portfolio Coordination.

The layer is additive and read-only over mission lifecycle, mission coordination, and mission governance semantics.

## Commands

List mission portfolios:

```bash
npm run mission-control:portfolios
```

Inspect a mission portfolio:

```bash
npm run mission-control:portfolio-inspect -- --portfolio <missionPortfolioId>
```

Inspect readiness posture:

```bash
npm run mission-control:portfolio-readiness -- --portfolio <missionPortfolioId>
```

Inspect health posture:

```bash
npm run mission-control:portfolio-health -- --portfolio <missionPortfolioId>
```

Inspect governance posture:

```bash
npm run mission-control:portfolio-governance -- --portfolio <missionPortfolioId>
```

Inspect blocking clusters:

```bash
npm run mission-control:portfolio-blocking -- --portfolio <missionPortfolioId>
```

Inspect portfolio membership:

```bash
npm run mission-control:portfolio-membership -- --portfolio <missionPortfolioId>
```

Inspect append-only portfolio history:

```bash
npm run mission-control:portfolio-history -- --portfolio <missionPortfolioId>
```

Materialize portfolio artifacts:

```bash
npm run mission-control:portfolio-materialize -- --portfolio <missionPortfolioId>
```

## Interpreting Portfolio States

Readiness:

- `ready`: majority mission posture is execution-ready
- `partially_ready`: mixed posture, readiness exists but not dominant
- `blocked`: critical/meaningful blockers exist
- `degraded`: broad quality degradation without full blockage
- `not_ready`: readiness has not been established
- `inconclusive`: insufficient reliable data

Health:

- `healthy`: stable mission execution posture
- `degraded`: minor but real operational issues
- `unstable`: mixed unstable behavior across missions
- `blocked`: active blocking clusters or blocked missions dominate
- `failed`: repeated mission failures dominate
- `inconclusive`: insufficient confidence

Governance posture:

- `clear`
- `awaiting_reviews`
- `decision_blocked`
- `deferred`
- `mixed`
- `inconclusive`

## Blocking Cluster Analysis

Blocking clusters summarize cross-mission constraints.

Use:

- `blockingMissionRunIds`
- `blockedMissionRunIds`
- `reasonTokens`
- `severity`

to trace root causes back to mission coordination and governance surfaces.

## Artifact Paths

Per portfolio:

- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-status.json`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-readiness.json`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-health.json`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-governance.json`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-membership.json`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-blocking.json`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-history.json`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-report.json`
- `artifacts/mission-control/portfolios/<missionPortfolioId>/mission-portfolio-report.md`

## Determinism Check

1. Run inspect twice for the same portfolio ID and compare output.
2. Run materialize twice for the same portfolio ID and compare artifact contents.
3. Validate history replay remains stable and deduplicated.
