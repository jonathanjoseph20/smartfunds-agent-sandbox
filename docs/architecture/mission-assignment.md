# Mission Assignment Engine (Sprint 4.3)

## Purpose

Sprint 4.3 adds deterministic mission assignment as a bounded, pre-execution layer.

Flow in this sprint:

mission
-> compatibility set
-> assignment policy evaluation
-> ranked candidates
-> assignment decision

This sprint does not execute teams, schedule missions, create runtime tasks, or invoke any runtime orchestration.

## Why Assignment Is Separate From Compatibility

Compatibility answers structural fit:

- Which teams are compatible with a mission?
- Which teams are blocked/manual/incomplete?

Assignment answers policy selection:

- Among compatible teams, which team should be selected under policy?
- Should the selection remain under review or be confirmed?

Compatibility truth remains immutable input. Assignment does not mutate compatibility truth.

## Domain Model

`MissionAssignmentDecision` includes:

- `assignmentDecisionId`
- `missionId`
- `compatibilitySetId`
- `selectedTeamId`
- `assignmentPolicyId`
- `assignmentMode`
- `decisionState`
- `decisionReason`
- `matchReasons`
- `blockingReasons`
- `limitations`
- `candidateTeams`
- `alternativeTeams`
- `founderOverride`
- `createdFrom`
- `historyDigest`

Candidate entries include deterministic rank and policy score metadata:

- `teamId`
- `compatibilityClass`
- `assignmentReadiness`
- `assignmentRank`
- `policyScoreClass`
- `matchReasons`
- `blockingReasons`
- `limitations`

## Determinism Model

Identity and digests use control-plane deterministic primitives:

- `canonicalStringify(...)`
- `sha256(...)`

`assignmentDecisionId` is derived from:

- `missionId`
- `compatibilitySetId`
- `assignmentPolicyId`
- candidate payload (ranked candidates, selected team, override payload, review triggers, decision mode/state)

Excluded from semantic identity:

- timestamps
- artifact paths
- CLI invocation details
- runtime metadata

Ranking precedence is deterministic:

1. compatibility class
2. assignment readiness
3. lifecycle preference
4. availability preference
5. lexical `teamId` tie-breaker

## Policy Model

Policy schema:

- `assignmentPolicyId`
- `displayName`
- `description`
- `selectionMode`
- `priorityRules`
- `manualReviewRules`
- `tieBreakerRules`
- `enabled`

Seeded policies:

- `founder-confirmation-default`
- `manual-review-first`
- `single-best-candidate`

## Decision Lifecycle and States

States:

- `draft`
- `recommended`
- `under_review`
- `confirmed`
- `blocked`
- `rejected`
- `archived`

Modes:

- `policy_selected`
- `founder_selected`
- `founder_override`
- `manual_review_required`
- `no_selection`

Manual review triggers include:

- ties among top-ranked candidates
- top candidate `manual_only`
- no `strong_match` candidates
- top candidate `restricted`
- founder-confirmation-required policy mode

## Founder Confirmation and Override

Founder confirmation is modeled as history on top of deterministic recommendation.

Founder override model:

- `applied`
- `selectedTeamId`
- `reason`
- `reviewedBy`

Sprint 4.3 constraint: overrides may only select from evaluated candidates.

Override writes a new assignment decision record and does not mutate compatibility truth.

## History, Projection, and Materialization

Append-only event families:

- `assignment_evaluated`
- `assignment_recommended`
- `assignment_confirmed`
- `assignment_rejected`
- `assignment_overridden`
- `assignment_materialized`

Artifacts are projection-only under:

- `artifacts/mission-assignment/<assignmentDecisionId>/`

Files:

- `assignment-status.json`
- `assignment-report.json`
- `assignment-report.md`
- `assignment-history.json`
- `assignment-candidates.json`

## Sprint 4.3 Non-Goals

Explicitly out of scope:

- team invocation
- mission execution activation
- scheduling
- runtime queues
- task DAG generation
- routing/orchestration
- concurrency semantics
- external APIs
- LLM/runtime integration
