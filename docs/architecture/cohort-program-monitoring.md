# Cohort Program Monitoring Layer

## Scope

Sprint 2.14 introduces deterministic cohort monitoring programs.

This layer is:
- projection-first
- deterministic
- bounded by explicit condition classes
- additive over existing cohort/investigation/signal/trigger/scheduler semantics
- operator-inspectable by CLI

This layer is not:
- planner logic
- swarm coordination
- dashboards
- adaptive strategy generation

## Layer Position

runtime
-> scheduler
-> persistent runtime
-> signal bus
-> trigger layer
-> investigation layer
-> synthesis layer
-> cohort layer
-> cohort program layer

## Program Model

Program lifecycle states:
- `pending`
- `active`
- `paused`
- `completed`

Cohort lifecycle states:
- `inactive`
- `monitoring`
- `investigating`
- `escalated`
- `stable`

Launch condition classes are finite and explicit:
- `cadence`
- `signal_type`
- `cohort_health`

Cadence types:
- `hourly`
- `daily`
- `weekly`
- `signal_driven`

`signal_driven` is never cadence-due on its own.

## Deterministic Dedupe

Program-scoped launch dedupe is derived from bounded fields:
- `programId`
- `cohortId`
- `slot`
- `conditionKind`
- `investigationTemplate`

No random IDs or wall-clock identity fields are used.

## Projection and Materialization

Projection is semantic truth:
- lifecycle state
- launch eligibility
- condition matches
- cohort lifecycle precedence

Materialization persists current projection only and never defines semantics.

Program artifacts are materialized under:
- `artifacts/cohorts/<cohortId>/programs/<programId>/program-status.json`
- `artifacts/cohorts/<cohortId>/programs/<programId>/program-history.json`
- `artifacts/cohorts/<cohortId>/programs/<programId>/program-report.md`

## Integration Boundary

Program-run uses existing investigation launch pathways.

No changes are made to investigation dedupe semantics.
No scheduler/trigger/signal behavior is modified beyond additive passive integration.
