# Research Team Operations Runbook

## Purpose

This runbook covers bounded research-team ownership, response status, linked work, history inspection, and artifact materialization.

## Commands

List bounded research teams:

```bash
npm run research-teams:list
```

Inspect full team projection:

```bash
npm run research-teams:inspect -- --team defi-risk-team
```

Inspect team activity/health state:

```bash
npm run research-teams:status -- --team defi-risk-team
```

Inspect linked work:

```bash
npm run research-teams:links -- --team defi-risk-team
```

Inspect append-only team history:

```bash
npm run research-teams:history -- --team defi-risk-team
```

Evaluate, record deterministic team events, and materialize artifacts:

```bash
npm run research-teams:materialize -- --team defi-risk-team --slot daily:2026-03-11
```

## Operator Interpretation

Ownership and response are visible from:
- `activityState`
- `healthState`
- `responseReasons`
- linked cohorts/programs/investigations/syntheses

History supports deterministic replay by explicit slot references.

## Determinism Notes

This layer enforces:
- canonical JSON serialization
- deterministic hashing for history dedupe
- stable list ordering for all outputs
- explicit rule matching only

## Compatibility Notes

Legacy research-team list command remains available:

```bash
npm run research:teams:list
```

Bounded-team list uses:

```bash
npm run research-teams:list
```
