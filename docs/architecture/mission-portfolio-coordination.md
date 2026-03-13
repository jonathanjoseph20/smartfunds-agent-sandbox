# Mission Portfolio Coordination

## Purpose

Mission Portfolio Coordination extends Mission Control with deterministic, bounded portfolio-level posture derived from mission projections.

This layer is additive and read-only relative to mission lifecycle, mission coordination, and mission governance state.

## Position In Stack

Mission Portfolio Coordination consumes:

- mission run projections
- mission coordination projections
- mission governance/review projections
- mission dependency relationships
- mission priority surfaces
- mission escalation and decision records

It does not mutate:

- mission lifecycle state
- mission coordination state
- mission governance state
- execution/runtime state

## Portfolio Model

`MissionPortfolio` contains:

- `missionPortfolioId`
- `displayName`
- `portfolioType`
- `missionRunIds`
- `membershipSummary`
- `priorityDistribution`
- `governancePosture`
- `readinessState`
- `healthState`
- `blockingClusterIds`

Portfolio types:

- `objective_portfolio`
- `coordination_portfolio`
- `dependency_cluster_portfolio`
- `governance_track_portfolio`
- `operating_domain_portfolio`

## Deterministic Identity

All identities use:

- `sha256(canonicalStringify(payload))`

Deterministic IDs include:

- portfolio ID
- membership ID
- blocking cluster ID
- history dedupe key

Excluded from identity payloads:

- timestamps
- random/process/env metadata
- filesystem paths

## Membership Logic

`MissionPortfolioMembership` includes:

- `missionPortfolioMembershipId`
- `missionPortfolioId`
- `missionRunId`
- `membershipClass`
- `reasonTokens`
- `state`

Membership classes:

- `shared_objective`
- `shared_dependency_chain`
- `shared_governance_track`
- `shared_priority_band`
- `explicit_portfolio_membership`
- `shared_operating_domain`

Membership derivation is deterministic, deduped, and lexically ordered.

## Readiness And Health Semantics

Readiness states:

- `not_ready`
- `partially_ready`
- `ready`
- `blocked`
- `degraded`
- `inconclusive`

Health states:

- `healthy`
- `degraded`
- `unstable`
- `blocked`
- `failed`
- `inconclusive`

Readiness and health are intentionally separate:

- readiness captures execution/governance availability posture
- health captures operational stability posture

## Governance Posture

Governance posture aggregates mission governance outcomes:

- `clear`
- `awaiting_reviews`
- `decision_blocked`
- `deferred`
- `mixed`
- `inconclusive`

## Blocking Cluster Derivation

`PortfolioBlockingCluster` is derived from dependency and governance constraints.

It is not an editable planning object.

Each cluster contains:

- blocking mission run IDs
- blocked mission run IDs
- reason tokens
- severity
- state

Clusters are deterministic and sorted by semantic identity.

## Projection, Inspection, Materialization

Projection computes truth:

- membership
- readiness
- health
- governance posture
- blocking clusters
- priority distribution
- escalation and decision summaries

Materialization persists projection truth under:

- `artifacts/mission-control/portfolios/<missionPortfolioId>/`

Artifacts:

- `mission-portfolio-status.json`
- `mission-portfolio-readiness.json`
- `mission-portfolio-health.json`
- `mission-portfolio-governance.json`
- `mission-portfolio-membership.json`
- `mission-portfolio-blocking.json`
- `mission-portfolio-history.json`
- `mission-portfolio-report.json`
- `mission-portfolio-report.md`

## History Model

Portfolio history is append-only and deduped via semantic event keys.

Event types:

- `mission_portfolio_created`
- `mission_portfolio_membership_added`
- `mission_portfolio_membership_removed`
- `mission_portfolio_blocking_detected`
- `mission_portfolio_blocking_resolved`
- `mission_portfolio_governance_updated`
- `mission_portfolio_readiness_updated`
- `mission_portfolio_materialized`

## CLI Surface

JSON-only CLI commands:

- `mission-control:portfolios`
- `mission-control:portfolio-inspect`
- `mission-control:portfolio-readiness`
- `mission-control:portfolio-health`
- `mission-control:portfolio-governance`
- `mission-control:portfolio-blocking`
- `mission-control:portfolio-membership`
- `mission-control:portfolio-history`
- `mission-control:portfolio-materialize`
