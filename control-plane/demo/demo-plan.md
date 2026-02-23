# Operational Demo Plan (3 Cycles)

## Purpose
Demonstrate a deterministic Code Factory loop in three cycles:
1) small feature, 2) deterministic refactor, 3) bug fix with regression test.

## Preconditions
- Working tree clean
- On `main`
- `origin/main` up to date
- Local tests pass

## Cycle 1: Small Feature (Tier 1 expected)
Goal: Introduce a pure, deterministic checksum helper with tests.
Commands:
- `npm run demo:prepare`
- `npm --workspace @smartfunds/mission-engine test`
- `npm run governance:generate`
- `npm run governance:normalize`
- `npm run governance:preflight`
- `npm run pr:create`
- `npm run pr:verify`

## Cycle 2: Deterministic Refactor (Tier 1 expected)
Goal: Refactor for clarity without behavior change.
Planned steps:
- Identify a small, safe refactor target.
- Add no new dependencies.
- Repeat governance workflow and verification.

## Cycle 3: Bug Fix + Regression Test (Tier 2 expected)
Goal: Fix a real issue with a failing test added first.
Planned steps:
- Add regression test (failing pre-fix).
- Implement minimal fix.
- Repeat governance workflow and verification.

## Notes
- Keep outputs deterministic (no timestamps, no randomness).
- Avoid modifying governance core logic or CI workflows.
