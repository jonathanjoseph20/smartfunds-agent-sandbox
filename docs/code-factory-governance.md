# Code Factory Governance

## Single source of truth

PR governance is profile-native:

- requested profile metadata in the PR body is optional
- required profile is derived from scope classification and policy registry
- final profile is the routed profile used by CI

Tier labels and evidence blocks are legacy-compatible metadata only. They do not drive routing or pass/fail.

## Current CI model

- detect governance profile
- run quality checks
- run profile-conditional validation for `build` or `core`
- emit a non-blocking notice for `lite`

## Local validation

- `npm run governance:preflight`
- `node --experimental-strip-types control-plane/validate-pr.ts --mode full`

Both commands use the same profile-native routing model as CI.

## Legacy compatibility

- Old tier labels may still appear on PRs as inert metadata.
- Old ` ```evidence ` blocks may still appear in PR bodies as inert metadata.
- Ownership diagnostics remain visible, but they do not block governance.
