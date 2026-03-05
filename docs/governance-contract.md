# Governance Contract

This document defines the governance rules for contributing changes to the SmartFunds Agent Sandbox repository.

The governance system is intentionally simple and deterministic so that both humans and AI agents can reliably open pull requests without CI failures.

---

# Core Principle

Every pull request must declare the risk level of the change and be labeled consistently with that declaration.

Governance validation checks that:

1. the declaration exists
2. the label matches the declaration
3. required approvals exist for high-risk changes

---

# Change Declaration

Each PR must include a declaration file:

governance/change.json

Example:

{
  "tier": 2,
  "mode": "structured",
  "justification": "Add new swarm orchestration command"
}

Fields:

tier — Risk level of the change  
mode — Execution mode (structured or autonomous)  
justification — Short explanation of the change

---

# Governance Tiers

## Tier 0 — Documentation / Non-code

Examples:

- README edits
- documentation updates
- comments
- formatting

Requirements:

label: tier-0

---

## Tier 1 — Safe Code Changes

Examples:

- small refactors
- internal tooling
- non-critical modules

Requirements:

label: tier-1

---

## Tier 2 — System Changes

Examples:

- control-plane logic
- swarm orchestration
- entity models
- infrastructure changes

Requirements:

label: tier-2

---

## Tier 3 — Critical Changes

Examples:

- governance logic
- security logic
- financial rails
- CI pipelines

Requirements:

label: tier-3

Additional required label:

tier-3-approved

---

# Required Labels

Each pull request must include exactly one tier label:

tier-0  
tier-1  
tier-2  
tier-3  

Tier-3 changes must also include:

tier-3-approved

---

# CI Governance Checks

The CI pipeline performs three categories of validation.

Workflow Integrity

Ensures CI workflows are valid and governance entrypoints exist.

Policy Lite

Used for tier-0 and tier-1 changes.

Policy Full

Used for tier-2 and tier-3 changes.

---

# What the System Does NOT Do

The governance system intentionally avoids:

- generated evidence artifacts
- PR body parsing
- retry loops
- self-modifying CI steps

These patterns previously caused CI instability.

---

# Design Goals

The governance layer must be:

deterministic  
CI-native  
simple to satisfy  
safe for autonomous agents

Agents should always be able to open valid PRs by following this contract.

---

# Summary

To open a valid PR:

1. create or update governance/change.json
2. set the correct tier label
3. add tier-3-approved if required
4. open the pull request

If these rules are followed, governance checks should pass deterministically.
