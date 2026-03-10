# Internal Demo: Governance Mode Enforcement (Sprint 19)

## Purpose
Demonstrate a deterministic, beginner-proof local demo that proves governance mode enforcement works without GitHub PRs or manual edits.

What we are proving:
- Autonomous-only changes pass when they do not violate profile-native policy.
- Structured-mode changes are evaluated by profile-native policy, not tier metadata.
- Mixed execution modes fail.

## Scenarios (Canonical)
1) autonomous-pass: Autonomous-only PR passes.
2) structured-pass: Structured-only PR passes when no profile-native policy is violated.
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
- `npm run demo:scenario -- --scenario structured-pass`
- `npm run demo:scenario -- --scenario mixed-fail`

## Expected Outcomes
Each scenario prints a stable summary and the key fields:
- `modeEnforcementStatus`
- `modeViolation`

Expected result by scenario:
- autonomous-pass: PASS
  - modeEnforcementStatus: ok
  - modeViolation: null
  - requiredMinimumTier: null

- structured-pass: PASS
  - modeEnforcementStatus: ok
  - modeViolation: null
  - requiredMinimumTier: null

- mixed-fail: FAIL
  - modeEnforcementStatus: failed
  - modeViolation: mixed_execution_modes
  - requiredMinimumTier: null

## Notes
- The demo runner creates and deletes temporary local branches for each scenario.
- No GitHub PRs are created.
- No governance logic is modified; the runner uses existing local preflight tooling.
