# Cohort Program Automation And Escalation

## Scope

Sprint 2.15 integrates cohort monitoring programs into automatic runtime behavior.

This layer is:
- deterministic
- projection-first
- append-only for automation/escalation history
- passive over scheduler and signal flows
- operator-inspectable by CLI

This layer is not:
- swarms
- bounded research teams
- dashboards
- Slack automation
- generalized orchestration

## Model

Automation evaluates cohort programs using explicit condition classes:
- `cadence`
- `signal_type`
- `cohort_health`
- `cohort_escalation`

Escalation is a bounded operational overlay and remains separate from cohort health/readiness.

Escalation states:
- `none`
- `elevated`
- `escalated`
- `critical`

## Deterministic Evaluation

Automation evaluation is deterministic by:
- explicit slot input
- stable condition ordering
- explicit signal filtering by `signalType`, `logDate`, and cohort subject token
- deterministic dedupe identity per program/slot/reason set

Escalation classification is deterministic by bounded rules over:
- projected cohort health/readiness
- bounded adverse signal window
- synthesis inconclusive state
- investigation confidence degradation signals

No random identity fields are used.

## Persistence

Program automation history (append-only):
- `artifacts/cohorts/<cohortId>/programs/<programId>/program-automation-history.json`
- `artifacts/cohorts/<cohortId>/programs/<programId>/program-automation-status.json`

Escalation history (append-only):
- `artifacts/cohorts/<cohortId>/escalation/escalation-history.json`
- `artifacts/cohorts/<cohortId>/escalation/escalation-status.json`

Repeated equivalent evaluations/transitions are deduped by deterministic keys.

## Integration Seams

Scheduler seam (`research:scheduler:tick`):
- scheduler remains source of slot timing
- automation and escalation execute after scheduler evaluation as passive downstream seams
- scheduler core semantics remain unchanged

Signal seam:
- persisted signals can trigger passive program automation evaluation by slot
- no fuzzy matching or speculative routing

## Inspectability

Operator-visible projections include:
- automation eligibility reasons
- triggering condition types
- dedupe outcome
- launched investigation references
- current escalation state and reasons
- escalation transition history

## Forward Compatibility

This sprint prepares deterministic surfaces for future bounded team assignment layers.

This sprint does not implement swarms, team assignment, or generalized orchestration.
