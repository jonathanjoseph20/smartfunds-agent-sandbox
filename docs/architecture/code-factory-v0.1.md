# Code Factory Governance Control Plane — v0.1

- Version: v0.1
- Status: Governance Frozen
- Date: 2026-02-23

## Purpose

This document freezes and formalizes the current governance control plane behavior as implemented in the repository at v0.1. No functional changes are introduced.

## Repository Layout

Governance-relevant structure:

- control-plane/** — governance validation logic and CLI entry points
- packages/mission-engine — mission state machine
- packages/doc-factory — document generation logic
- .github/workflows/code-factory.yml — CI enforcement
- docs/** — governance documentation

## Governance Model

### Tier System

- tier-0
- tier-1
- tier-2
- tier-3

### Declared Tier vs Label Tier vs Implied Tier

- Declared tier: the unfenced `tier-*` line in the PR body.
- Label tier: the GitHub label applied to the PR.
- Implied tier: derived from affected paths and governance validation logic.

### Tier 3 Approval Requirement

tier-3 PRs require both:

- `tier-3` label
- `tier-3-approved` label

as enforced by CI.

## PR Body Contract

Requirements:

- Exactly one unfenced `tier-*` line in the PR body.
- Exactly one fenced evidence block using ```evidence.
- No leading spaces before the opening fence.
- Deterministic formatting.
- Stable ordering.
- No hidden mutation.

## Canonical CLI Workflow

The following npm scripts are the authoritative governance entry points.

### 1. Normalize PR Body (optional but recommended)

npm run governance:normalize -- .pr-body.md

Ensures deterministic formatting and correct tier/evidence structure.

### 2. Run Governance Preflight (local validation)

npm run governance:preflight

Runs governance validation checks before PR creation.

### 3. Create PR (blessed path)

npm run pr:create -- --body-file .pr-body.md

This command:

- Validates the PR body structure.
- Ensures GitHub CLI (gh) is available.
- Ensures gh is authenticated.
- Creates the PR using gh pr create.
- Verifies the PR body on GitHub after creation.

### 4. Verify PR (post-creation validation)

npm run pr:verify

Re-validates PR body and confirms correct tier detection.

### 5. Refresh PR Metadata (if CI reads stale body or labels)

npm run pr:refresh-metadata

If CI still reads stale PR data, push an empty commit:

git commit --allow-empty -m "chore: refresh metadata"
git push

### 6. Manual Inspection (GitHub CLI)

gh pr view --json body --jq .body

Confirms the PR body matches the required contract.

## CI Enforcement Layers

Current CI checks include:

- policy
- lint_tier0
- integration_tests
- schema_checks
- unit_tests
- tier3_label_gate

## Operational Gotchas

### Stale PR Metadata

If CI reads stale PR body or labels, run:

npm run pr:refresh-metadata

If necessary, push an empty commit.

### Body in Comment vs PR Description

Governance reads the PR description, not comments.

Use:

gh pr edit --body-file .pr-body.md

### Missing Labels

Apply required tier labels in GitHub UI.

## Freeze Policy

No governance edits without explicit version bump.

Future governance changes require version increment (v0.2+).

## Future Work

- Improve CLI ergonomics
- Expand governance audit logging
- Strengthen deterministic lint enforcement
