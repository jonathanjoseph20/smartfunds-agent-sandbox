# Synthesis Operations and Hygiene

## Purpose

This runbook covers operator workflows for hardened synthesis projection, conflict inspection, and explicit materialization.

## Commands

Status:

```bash
npm run synthesis:status -- --synthesis <id>
```

Why linked:

```bash
npm run synthesis:why -- --synthesis <id>
```

Conflicts:

```bash
npm run synthesis:conflicts -- --synthesis <id>
```

Projection (no persistence):

```bash
npm run synthesis:project -- --synthesis <id>
```

Materialize artifacts:

```bash
npm run synthesis:materialize -- --synthesis <id>
```

## Projection vs Materialization

Projection is side-effect free for artifacts.
Materialization is the only path that writes synthesis runtime artifacts.

## Artifact Paths

Synthesis runtime artifacts are stored at:

`artifacts/syntheses/<synthesisId>/`

Expected files:
- `synthesis-report.json`
- `synthesis-report.md`
- `synthesis-status.json`
- `synthesis-conflicts.json`

## Inspection Workflow

1. Run `synthesis:status` to check readiness.
2. Run `synthesis:why` to inspect deterministic linking reasons.
3. Run `synthesis:conflicts` to inspect contradiction classes.
4. Run `synthesis:project` to verify final projected state.
5. Run `synthesis:materialize` only when operator wants persisted artifacts.

## Cleanup Rules

Runtime artifacts can be removed without affecting synthesis definitions.
Do not store runtime-generated outputs in definition directories.

## Operational Boundary

This runbook does not introduce cohort/team/swarm orchestration semantics.
