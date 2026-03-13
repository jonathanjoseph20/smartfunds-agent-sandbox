# Cross-Portfolio Mission Intelligence

## Purpose

Sprint 7.7 introduces deterministic cross-portfolio mission intelligence above Mission Portfolio Resolution & Closure.

This layer:

- consumes existing mission portfolio projections as read-only truth
- derives systemic signals across multiple portfolios
- persists append-only intelligence history
- materializes projection outputs for operator inspection

This layer does **not**:

- mutate mission/portfolio/runtime governance state
- execute workflow logic
- perform venture/business portfolio analytics
- perform planning, allocation, or staffing optimization

## Layering

Control-plane layering is additive:

- Mission portfolio coordination projection
- Mission portfolio attention projection
- Mission portfolio resolution projection
- Cross-portfolio mission intelligence projection

Projection modules compute semantic truth.
Materialization writes projection outputs only and does not redefine semantics.

## Deterministic Identity

All semantic identities are deterministic:

- `canonicalStringify(payload)`
- `sha256(serializedPayload)`

New deterministic IDs:

- `crossPortfolioMissionIntelligenceSetId`
- `crossPortfolioSharedDependencyId`
- `systemicBlockingClusterId`
- `crossPortfolioEscalationPatternId`

Identity payloads exclude timestamps, process metadata, env metadata, and artifact paths.

## Core Semantic Objects

Cross-portfolio intelligence introduces:

- intelligence sets
- shared dependency surfaces
- systemic blocking clusters
- escalation patterns
- systemic risk posture
- cross-portfolio readiness posture
- operator-facing intelligence outcome

## Minimal Deterministic Heuristics

The first version intentionally uses bounded, explainable heuristics:

- Shared dependencies:
  - repeated blocking cluster IDs
  - repeated attention requirement classes
  - repeated governance blocked/deferred posture
  - repeated unresolved resolution posture
  - repeated dependency/blocking reason tokens
- Systemic blocking clusters:
  - repeated blocking cluster IDs across 2+ portfolios
  - severity from blocked closure and escalation severity concentration
- Escalation patterns:
  - repeated blocking escalation
  - repeated governance block
  - repeated resolution regression
  - critical priority concentration
  - unresolved attention pattern
  - systemic inconclusive pattern
- Systemic risk posture:
  - derived from blocked closure counts, inconclusive concentration, cluster/pattern severities
- Readiness posture:
  - derived from cross-portfolio blocked/degraded/ready distribution
- Intelligence outcome:
  - derived from risk + readiness + cluster/pattern presence

## Append-Only History

History events are append-only and deduplicated by deterministic dedupe keys.
Re-running the same projection/materialization with identical inputs does not create semantically new history.

History events:

- `cross_portfolio_intelligence_set_created`
- `cross_portfolio_shared_dependency_detected`
- `cross_portfolio_blocking_cluster_detected`
- `cross_portfolio_escalation_pattern_detected`
- `cross_portfolio_risk_posture_updated`
- `cross_portfolio_readiness_updated`
- `cross_portfolio_materialized`

## Materialization

Artifacts are written under:

- `artifacts/mission-control/cross-portfolio/<intelligenceSetId>/`

Files:

- `cross-portfolio-intelligence-status.json`
- `cross-portfolio-shared-dependencies.json`
- `cross-portfolio-blocking-clusters.json`
- `cross-portfolio-escalation-patterns.json`
- `cross-portfolio-risk.json`
- `cross-portfolio-readiness.json`
- `cross-portfolio-intelligence-history.json`
- `cross-portfolio-intelligence-report.json`
- `cross-portfolio-intelligence-report.md`

## CLI Inspectability

All commands return JSON only with deterministic ordering and stable errors.

Missing set error payload:

- `{"error":"intelligence_set_not_found"}`
