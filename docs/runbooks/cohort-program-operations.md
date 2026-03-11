# Cohort Program Operations

## Purpose

This runbook covers deterministic cohort program inspection and execution.

## Commands

List programs for a cohort:

```bash
npm run cohorts:programs -- --cohort <id>
```

Inspect projected program/cohort lifecycle:

```bash
npm run cohorts:program-status -- --cohort <id>
```

Inspect persisted program history:

```bash
npm run cohorts:program-history -- --cohort <id>
```

Evaluate and run one program:

```bash
npm run cohorts:program-run -- --program <id>
```

Optional deterministic slot override:

```bash
npm run cohorts:program-run -- --program <id> --slot daily:2026-03-11
```

## Lifecycle Interpretation

Program lifecycle:
- `pending`: program exists but has no execution history or remains pending by definition
- `active`: enabled and executing according to cadence/conditions
- `paused`: disabled or paused by definition
- `completed`: completed by definition

Cohort lifecycle:
- `inactive`: no active monitoring and no active linked investigations
- `investigating`: linked investigations are currently active
- `escalated`: degraded/conflicted/unstable cohort health with escalation condition satisfied
- `monitoring`: active program in force without active investigation/escalation
- `stable`: active program with healthy steady state and no active investigation/escalation

## Artifact Contract

Program artifacts are written per cohort/program:

- `program-status.json`
- `program-history.json`
- `program-report.md`

Materialization stores projected state; it does not define semantic truth.

## Out of Scope

This workflow does not include:
- planner logic
- multi-agent orchestration
- dashboards
- Slack automation
