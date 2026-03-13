# Mission Control Orchestration and Systemic Intervention Planning

## Purpose
Sprint 7.8 adds a deterministic Mission Control orchestration layer that consumes cross-portfolio mission intelligence and derives bounded intervention plans. This layer is a control-plane planner for systemic stabilization only. It is not a generalized planner.

## Core Entities

### Mission Control Intervention Plan
A systemic plan keyed by deterministic identity and linked to one cross-portfolio intelligence set.

Fields:
- `missionControlInterventionPlanId`
- `crossPortfolioMissionIntelligenceSetId`
- `displayName`
- `strategyClass`
- `portfolioIds`
- `systemicBlockingClusterIds`
- `escalationPatternIds`
- `actionItemIds`
- `priority`
- `outcome`
- `state`

### Systemic Stabilization Strategy
A bounded strategy class selected by deterministic rules from risk/readiness/blocking/escalation posture.

### Orchestration Action Item
Deterministic bounded actions derived from strategy class and intervention posture.

### Orchestration Queue Entry
A deterministic queue representation of intervention plans entering orchestration.

### Priority and Outcome
Priority is derived from:
- systemic risk posture
- readiness posture
- blocking cluster severity
- escalation pattern severity

Outcome is derived from queue state, action states, and append-only history events.

## Projection-First Truth
Truth is computed by projection:
- cross-portfolio intelligence projection
- portfolio attention projection
- portfolio resolution projection
- mission governance projection
- orchestration history

Materialization writes projection truth to artifacts and does not redefine semantic truth.

## Append-Only History
Orchestration transitions are stored as append-only events with deterministic dedupe keys. Replay reproduces orchestration posture deterministically.

## Why This Is Not Generalized Planning
This layer is explicitly bounded to:
- systemic intervention plans
- fixed strategy classes
- fixed action classes
- fixed queue/priority/outcome models

It does not perform open-ended planning, capital allocation, staffing, or runtime execution mutation.
