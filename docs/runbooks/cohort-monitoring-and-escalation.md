# Cohort Monitoring And Escalation Runbook

## Purpose

This runbook covers deterministic cohort program automation and cohort escalation inspection.

## Commands

Evaluate programs automatically for a deterministic slot:

```bash
npm run cohorts:program-evaluate -- --slot daily:2026-03-11
```

Evaluate programs for one cohort:

```bash
npm run cohorts:program-evaluate -- --cohort aave-risk --slot daily:2026-03-11
```

Inspect automation eligibility/status for a cohort:

```bash
npm run cohorts:automation-status -- --cohort aave-risk --slot daily:2026-03-11
```

Inspect escalation projection (non-mutating):

```bash
npm run cohorts:escalation -- --cohort aave-risk --slot daily:2026-03-11
```

Evaluate and persist escalation transition:

```bash
npm run cohorts:escalation -- --cohort aave-risk --slot daily:2026-03-11 --evaluate
```

Inspect escalation history:

```bash
npm run cohorts:escalation-history -- --cohort aave-risk
```

Inspect cohort program execution history:

```bash
npm run cohorts:program-history -- --cohort aave-risk
```

## Reason Tracing

Automation output exposes:
- `evaluationState`
- `triggerReasons`
- `triggeringConditionTypes`
- `lastSignalReferences`
- `launchedInvestigationIds`
- `dedupeKey`

Escalation output exposes:
- `escalationState`
- `escalationReasons`
- `linkedSignals`
- `linkedSyntheses`
- `linkedInvestigations`

## Dedupe Behavior

Automation dedupes repeated equivalent slot evaluations for the same:
- program
- cohort
- slot reference
- condition set
- reason set

Escalation history dedupes repeated equivalent transitions for the same:
- prior state
- next state
- reason set
- linked context
- slot reference

## Replay

Use explicit slot input for deterministic replay:
- `daily:YYYY-MM-DD`
- `interval_hours:<n>:YYYY-MM-DDTHH:MMZ`
- `weekly:YYYY-MM-DD`

## Scope Boundaries

This runbook excludes:
- swarms
- bounded research team assignment
- dashboards
- Slack automation
- generalized orchestration graphs
