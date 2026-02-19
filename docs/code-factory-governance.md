# Code Factory Governance Upgrade (Operational Hardening v1)

This document defines the minimum governance controls for SmartFunds Phase 1 shipping.

## Push Preflight

Run this preflight in every **new Codex environment** before starting feature work.

1. Verify remotes and authentication.
   - `git remote -v`
   - `git fetch origin`
   - Optional auth check: `gh auth status` (if GitHub CLI is installed)
2. Create and push a tiny preflight branch.
   - `git checkout -b preflight/<initials>-<date>`
   - `git commit --allow-empty -m "chore: push preflight"`
   - `git push -u origin HEAD`
3. Confirm branch is present on origin.
   - `git ls-remote --heads origin "preflight/<initials>-<date>"`
4. Open a PR and confirm visibility on GitHub.
   - `gh pr create --fill --base main --head preflight/<initials>-<date>`
   - Verify the PR appears in GitHub UI and is visible to maintainers.
5. On the VPS, verify branch fetchability and commit presence.
   - `git fetch origin preflight/<initials>-<date>`
   - `git rev-parse FETCH_HEAD`
   - `git branch --contains <commit_sha>`

If any step fails, stop feature delivery and fix transport/auth reliability first.

## PR Template Requirements

Every PR must include:

- **Risk tier declaration (Tier 0–3)** and rationale.
- **Evidence checklist** for commands/results (tests, typecheck/schema validation, policy checks).
- **Bug fix regression evidence** when applicable:
  - Link to regression test file and test name.
  - Proof that regression failed before the fix (or reproduction notes).

## Merge Gate Checklist

Before merge:

- Working tree is clean (`git status --porcelain` empty).
- No untracked debug/build artifacts.
- Required CI checks are green for the declared risk tier.
- **Tier 2 and Tier 3** require verifier approval.
- **Tier 3** additionally requires human merge approval (maintainer) before merge.

## Workspace-Scoped CI Policy

SmartFunds CI runs checks based on impacted workspaces from changed paths.

- Always run policy checks (risk tier validation).
- Run checks only for changed workspaces where possible.
- If no workspaces are impacted, run policy checks plus a lightweight sanity command.
- Tier requirements:
  - **Tier 0**: lint/typecheck + unit tests for impacted workspaces.
  - **Tier 1**: unit tests for impacted workspaces.
  - **Tier 2**: unit + integration tests for impacted workspaces + schema checks when doc/export paths change.
  - **Tier 3**: Tier 2 checks + `tier-3-approved` label gate and branch protection requiring human approval.

## Hygiene

Mandatory cleanup before handoff:

- `git restore .`
- `git clean -fd`

Debug artifact policy:

- Do not commit temporary databases, scratch backups, tsbuildinfo, or ad hoc logs.
- Keep debug output local and clean workspace before commit.

## Related Files

- PR template: `.github/pull_request_template.md`
- CI policy enforcement: `.github/workflows/code-factory.yml`
- Helper scripts:
  - `scripts/push-preflight.sh`
  - `scripts/validate-clean-tree.sh`
