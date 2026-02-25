# Internal Demo: Governance Mode Enforcement (Sprint 19)

## Purpose
Demonstrate a deterministic, beginner-proof local demo that proves governance mode enforcement works without GitHub PRs or manual edits.

What we are proving:
- Autonomous-only changes pass at a low tier.
- Structured-mode changes require tier-2 or higher.
- Mixed execution modes fail.

## Scenarios (Canonical)
1) autonomous-pass: Autonomous-only PR passes at low tier.
2) structured-fail: Structured-mode touched at tier-1 fails with `structured_min_tier_violation` and `requiredMinimumTier=2`.
3) structured-pass: Structured-mode touched at tier-2 passes.
4) mixed-fail: Mixed-mode PR fails with `mixed_execution_modes`.

## Beginner-Proof Setup
1) Ensure a clean working tree:
   - `git status -sb`
2) Ensure you are on `main`:
   - `git checkout main`
3) Install deps (first time only):
   - `npm install`

## One-Command Demo Runner
Run all four scenarios in order:
- `npm run demo:run`

## Optional: Run a Single Scenario
- `npm run demo:scenario -- --scenario autonomous-pass`
- `npm run demo:scenario -- --scenario structured-fail`
- `npm run demo:scenario -- --scenario structured-pass`
- `npm run demo:scenario -- --scenario mixed-fail`

## Expected Outcomes
Each scenario prints a stable summary and the key fields:
- `modeEnforcementStatus`
- `modeViolation`
- `requiredMinimumTier`

Expected result by scenario:
- autonomous-pass: PASS (tier-1)
  - modeEnforcementStatus: ok
  - modeViolation: null
  - requiredMinimumTier: null

- structured-fail: FAIL
  - modeEnforcementStatus: failed
  - modeViolation: structured_min_tier_violation
  - requiredMinimumTier: 2

- structured-pass: PASS (tier-2)
  - modeEnforcementStatus: ok
  - modeViolation: null
  - requiredMinimumTier: 2

- mixed-fail: FAIL
  - modeEnforcementStatus: failed
  - modeViolation: mixed_execution_modes
  - requiredMinimumTier: null

## Notes
- The demo runner creates and deletes temporary local branches for each scenario.
- No GitHub PRs are created.
- No governance logic is modified; the runner uses existing local preflight tooling.
