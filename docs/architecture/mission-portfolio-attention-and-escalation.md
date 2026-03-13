# Mission Portfolio Attention, Escalation, and Operator Action

## Purpose

Sprint 7.5 adds a deterministic portfolio-level attention/action layer above Mission Portfolio Coordination.

This layer answers:

- does a portfolio require attention?
- why is attention required?
- is posture acknowledged, deferred, escalated, or suppressed?
- which append-only operator actions explain current posture?

## Relationship to Portfolio Coordination

Mission Portfolio Coordination (Sprint 7.4) derives portfolio posture from mission coordination/governance truth.

Mission Portfolio Attention (Sprint 7.5):

- consumes that coordination projection
- derives attention requirements and escalation posture
- records append-only operator actions
- projects attention status and outcomes

It does not mutate portfolio coordination truth.

## Why This Layer Is Distinct

Portfolio coordination models portfolio state.
Portfolio attention models operator-facing intervention posture over that state.

This separation keeps:

- upstream truth projection-first
- operator actions append-only
- replay deterministic
- governance boundaries explicit

## Determinism

All semantic identities use:

- `sha256(canonicalStringify(payload))`

Identity payloads exclude:

- timestamps
- filesystem paths
- process/env metadata
- random values

Deterministic identities:

- `portfolioAttentionRequirementId`
- `portfolioEscalationId`
- `portfolioAttentionQueueEntryId`
- `portfolioOperatorActionRecordId`

## Core Models

### Attention Requirements

Derived classes:

- `critical_blocking_cluster`
- `governance_mixed_attention`
- `critical_priority_attention`
- `degraded_health_attention`
- `failed_member_attention`
- `operator_forced_attention`
- `inconclusive_attention`

### Escalations

Derived classes:

- `portfolio_blocked`
- `portfolio_unstable`
- `portfolio_governance_blocked`
- `portfolio_critical_overload`
- `portfolio_priority_conflict`
- `portfolio_inconclusive`

### Queue

Queue entries are deterministic and ordered by:

1. severity descending
2. priority descending
3. mission portfolio ID ascending

### Operator Actions

Action records are append-only:

- `acknowledge`
- `defer`
- `escalate`
- `force_review`
- `suppress`
- `request_portfolio_review`

## History Model

Append-only, deduplicated, replay-safe events:

- `portfolio_attention_required`
- `portfolio_escalation_opened`
- `portfolio_attention_queued`
- `portfolio_attention_acknowledged`
- `portfolio_attention_deferred`
- `portfolio_attention_escalated`
- `portfolio_attention_suppressed`
- `portfolio_operator_action_recorded`
- `portfolio_attention_closed`

## Projection and Materialization

Projection computes truth from:

- mission portfolio projection
- attention history / operator action history

Materializer persists projection output to:

- `artifacts/mission-control/portfolios/<missionPortfolioId>/`

Artifacts:

- `mission-portfolio-attention-status.json`
- `mission-portfolio-attention-queue.json`
- `mission-portfolio-escalations.json`
- `mission-portfolio-action-history.json`
- `mission-portfolio-action-outcome.json`
- `mission-portfolio-attention-report.json`
- `mission-portfolio-attention-report.md`
- `mission-portfolio-attention-requirements.json`

## Non-Goals

This layer excludes:

- dashboards/UI
- notifications/integrations
- venture portfolio allocation logic
- planning engines
- runtime mutation
