# Market Intelligence Operations

## Purpose

This runbook covers deterministic operator inspection and artifact materialization for market intelligence synthesis units.

## Commands

List market synthesis units:

```bash
npm run market-synthesis:list
```

Inspect a market synthesis unit:

```bash
npm run market-synthesis:inspect -- --market <id>
```

Inspect status summary:

```bash
npm run market-synthesis:status -- --market <id>
```

Inspect linked cross-swarms and rationale:

```bash
npm run market-synthesis:links -- --market <id>
```

Inspect readiness/completion signals:

```bash
npm run market-synthesis:readiness -- --market <id>
```

Inspect append-only history:

```bash
npm run market-synthesis:history -- --market <id>
```

Materialize artifacts:

```bash
npm run market-synthesis:materialize -- --market <id>
```

## Interpreting Blockers

Readiness:
- `pending`: no linked cross-swarms or no meaningful progress
- `analyzing`: linked cross-swarms are active but not yet coherent
- `coherent`: linked cross-swarms are consistent and non-blocked
- `blocked`: explicit blockers/conflicts/contradictions exist

Completion:
- `completed`: coherent and fully satisfied linked completion support
- `incomplete`: still progressing with no explicit contradiction
- `inconclusive`: weak coverage or conflicting support prevents reliable conclusion

Always review:
- `blockingReasons`
- `limitations`
- `rationale`

## Artifact Layout

Per market synthesis unit:
- `artifacts/market-synthesis/<marketSynthesisId>/market-synthesis-status.json`
- `artifacts/market-synthesis/<marketSynthesisId>/market-synthesis-history.json`
- `artifacts/market-synthesis/<marketSynthesisId>/market-synthesis-report.json`
- `artifacts/market-synthesis/<marketSynthesisId>/market-synthesis-report.md`

## Boundary

This runbook is scoped to bounded market intelligence synthesis only.

Out of scope:
- portfolio intelligence
- capital allocation
- treasury or trading logic
- orchestration planning
- dashboards
- Slack automation
