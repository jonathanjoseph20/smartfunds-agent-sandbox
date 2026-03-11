# Portfolio Intelligence Operations

## Purpose

This runbook covers deterministic operator inspection and artifact materialization for portfolio intelligence units.

## Commands

List portfolio intelligence units:

```bash
npm run portfolio-intelligence:list
```

Inspect a portfolio intelligence unit:

```bash
npm run portfolio-intelligence:inspect -- --portfolio <id>
```

Inspect lifecycle/readiness/completion and blockers:

```bash
npm run portfolio-intelligence:status -- --portfolio <id>
```

Inspect linked market syntheses and rationale:

```bash
npm run portfolio-intelligence:links -- --portfolio <id>
```

Inspect readiness/completion signals:

```bash
npm run portfolio-intelligence:readiness -- --portfolio <id>
```

Inspect risk surface:

```bash
npm run portfolio-intelligence:risk -- --portfolio <id>
```

Inspect append-only history:

```bash
npm run portfolio-intelligence:history -- --portfolio <id>
```

Materialize artifacts:

```bash
npm run portfolio-intelligence:materialize -- --portfolio <id>
```

## Interpreting Readiness States

Readiness:
- `pending`: no linked market synthesis coverage or no meaningful progress
- `analyzing`: linked market syntheses are active but not coherent yet
- `coherent`: linked market syntheses are coherent with no blocking reasons
- `blocked`: explicit blockers/conflicts/inconclusive dependencies exist

Completion:
- `completed`: coherent and all linked market syntheses completed
- `incomplete`: still progressing without explicit contradiction
- `inconclusive`: blockers/conflicts/insufficiently reliable support

Always review:
- `blockingReasons`
- `limitations`
- `rationale`

## Interpreting Risk Surfaces

`riskThemes` provide bounded descriptive themes, not actions.

`exposureFlags` identify observed exposure signals (protocol/asset/event and blocked/inconclusive dependencies).

`concentrationWarnings` identify clustered dependency patterns (for example repeated protocol/event concentration).

## Artifact Locations

Per portfolio intelligence unit:
- `artifacts/portfolio-intelligence/<portfolioId>/portfolio-status.json`
- `artifacts/portfolio-intelligence/<portfolioId>/portfolio-history.json`
- `artifacts/portfolio-intelligence/<portfolioId>/portfolio-report.json`
- `artifacts/portfolio-intelligence/<portfolioId>/portfolio-report.md`

## Boundary

These commands are for bounded portfolio intelligence only.

Out of scope:
- capital allocation
- trading or treasury logic
- orchestration/action systems
- dashboards
- Slack automation
