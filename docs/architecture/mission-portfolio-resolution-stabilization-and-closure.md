# Mission Portfolio Resolution, Stabilization, and Closure

## Purpose

Sprint 7.6 adds deterministic resolution/closure posture above Mission Portfolio Attention (Sprint 7.5).

This layer answers:

- is a portfolio stabilizing or regressing?
- is attention posture resolved?
- is the portfolio eligible for closure?
- what is the current resolution queue posture?
- has the portfolio been closed, reopened, or archived?

## Layering

Mission Portfolio Resolution:

- consumes mission portfolio attention projection and append-only resolution history
- derives stabilization, resolution, closure eligibility, queue state, closure state, and outcome
- records append-only operator resolution actions
- materializes resolution projection outputs

It does not mutate upstream mission portfolio/attention truth.

## Determinism

All semantic identities are derived via canonical hashing:

- `sha256(canonicalStringify(payload))`

Deterministic identities include:

- `portfolioStabilizationId`
- `portfolioResolutionStatusId`
- `portfolioClosureEligibilityId`
- `portfolioResolutionQueueEntryId`
- `portfolioResolutionActionRecordId`

Ordering is explicit and stable:

- history replay sorted by deterministic dedupe key
- queue ordering sorted by queue state rank, then priority, then mission portfolio ID

## Core Models

### Stabilization

Statuses:

- `not_stable`
- `stabilizing`
- `stable`
- `regressed`
- `inconclusive`

### Resolution Status

Statuses:

- `unresolved`
- `partially_resolved`
- `resolved`
- `reopened`
- `inconclusive`

### Closure Eligibility

Statuses:

- `not_closeable`
- `conditionally_closeable`
- `closeable`
- `blocked_from_closure`
- `inconclusive`

### Resolution Queue

Queue states:

- `queued`
- `awaiting_resolution_review`
- `under_resolution_review`
- `ready_to_close`
- `deferred`
- `closed`

### Resolution Action Record

Append-only action types:

- `mark_stable`
- `mark_resolved`
- `close`
- `reopen`
- `archive`
- `defer_closure`
- `request_resolution_review`

Actor is deterministic token: `operator`.

### Closure State

States:

- `open`
- `under_resolution_review`
- `ready_to_close`
- `closed`
- `reopened`
- `archived`
- `inconclusive`

### Resolution Outcome

Values:

- `pending`
- `stabilized`
- `resolved`
- `deferred`
- `closed`
- `reopened`
- `archived`
- `inconclusive`

## History Model

Append-only, deduplicated, replay-safe events:

- `portfolio_stabilization_detected`
- `portfolio_resolution_started`
- `portfolio_resolution_queued`
- `portfolio_marked_stable`
- `portfolio_marked_resolved`
- `portfolio_closure_deferred`
- `portfolio_closed`
- `portfolio_reopened`
- `portfolio_archived`
- `portfolio_resolution_closed`

## Projection and Materialization

Projection outputs are materialized under:

- `artifacts/mission-control/portfolios/<missionPortfolioId>/`

Artifacts:

- `mission-portfolio-stabilization.json`
- `mission-portfolio-resolution-status.json`
- `mission-portfolio-closure-eligibility.json`
- `mission-portfolio-resolution-queue.json`
- `mission-portfolio-resolution-action-history.json`
- `mission-portfolio-closure-state.json`
- `mission-portfolio-resolution-outcome.json`
- `mission-portfolio-resolution-report.json`
- `mission-portfolio-resolution-report.md`

## Relationship to Portfolio Attention

Portfolio attention determines intervention need.
Portfolio resolution determines whether intervention has stabilized, resolved, or closed.

Both layers preserve:

- projection-first truth
- append-only operator histories
- deterministic replay and inspectability
