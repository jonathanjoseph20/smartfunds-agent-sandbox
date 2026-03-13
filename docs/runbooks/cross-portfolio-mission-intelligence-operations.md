# Cross-Portfolio Mission Intelligence Operations

## Purpose

Operate deterministic cross-portfolio mission intelligence for mission-control operators.

This runbook covers:

- listing and inspecting intelligence sets
- interpreting dependency surfaces and blocking clusters
- interpreting escalation patterns
- interpreting systemic risk/readiness/outcome
- materializing deterministic artifacts

## Inspect Intelligence Sets

List sets:

```bash
npm run mission-control:cross-portfolio-list
```

Inspect one set:

```bash
npm run mission-control:cross-portfolio-inspect -- --intelligence-set <intelligenceSetId>
```

Inspect shared dependencies:

```bash
npm run mission-control:cross-portfolio-dependencies -- --intelligence-set <intelligenceSetId>
```

Inspect systemic blocking clusters:

```bash
npm run mission-control:cross-portfolio-blocking -- --intelligence-set <intelligenceSetId>
```

Inspect escalation patterns:

```bash
npm run mission-control:cross-portfolio-escalation-patterns -- --intelligence-set <intelligenceSetId>
```

Inspect systemic risk posture:

```bash
npm run mission-control:cross-portfolio-risk -- --intelligence-set <intelligenceSetId>
```

Inspect readiness posture:

```bash
npm run mission-control:cross-portfolio-readiness -- --intelligence-set <intelligenceSetId>
```

Inspect append-only history:

```bash
npm run mission-control:cross-portfolio-history -- --intelligence-set <intelligenceSetId>
```

## Interpretation Guidance

Shared dependencies:

- indicate repeated dependency signals across multiple portfolios
- use `dependencyClass` and `reasonTokens` for deterministic explanation

Systemic blocking clusters:

- indicate blocking concentration across multiple portfolios
- use severity (`low`..`critical`) and linked blocking cluster IDs

Escalation patterns:

- indicate recurring systemic escalation shapes
- use `patternClass`, `severity`, and `portfolioIds` to determine breadth and urgency

Systemic risk posture:

- `clear`: no meaningful systemic risk concentration
- `degraded`: emerging concentration, operator watch advised
- `unstable`/`critical`: high-severity concentration
- `blocked`: closure/readiness blocking concentration
- `inconclusive`: insufficient or fully inconclusive signals

Readiness posture:

- describes cross-portfolio operational readiness distribution
- does not override underlying per-portfolio readiness semantics

Intelligence outcome:

- `clear`, `watch`, `attention_required`, `systemically_blocked`, `systemically_unstable`, `inconclusive`
- summary is derived from risk + readiness + systemic cluster/pattern concentration

## Materialize Artifacts

```bash
npm run mission-control:cross-portfolio-materialize -- --intelligence-set <intelligenceSetId>
```

Artifacts:

- `artifacts/mission-control/cross-portfolio/<intelligenceSetId>/cross-portfolio-intelligence-status.json`
- `artifacts/mission-control/cross-portfolio/<intelligenceSetId>/cross-portfolio-shared-dependencies.json`
- `artifacts/mission-control/cross-portfolio/<intelligenceSetId>/cross-portfolio-blocking-clusters.json`
- `artifacts/mission-control/cross-portfolio/<intelligenceSetId>/cross-portfolio-escalation-patterns.json`
- `artifacts/mission-control/cross-portfolio/<intelligenceSetId>/cross-portfolio-risk.json`
- `artifacts/mission-control/cross-portfolio/<intelligenceSetId>/cross-portfolio-readiness.json`
- `artifacts/mission-control/cross-portfolio/<intelligenceSetId>/cross-portfolio-intelligence-history.json`
- `artifacts/mission-control/cross-portfolio/<intelligenceSetId>/cross-portfolio-intelligence-report.json`
- `artifacts/mission-control/cross-portfolio/<intelligenceSetId>/cross-portfolio-intelligence-report.md`

## Determinism Checks

1. Re-run inspect commands and confirm byte-equivalent JSON for the same inputs.
2. Re-run materialization and confirm no semantically new history entries are appended.
3. Confirm upstream mission portfolio projections are unchanged after cross-portfolio projection/materialization.

## Stable Error Contract

Missing set must return exactly:

```json
{"error":"intelligence_set_not_found"}
```
