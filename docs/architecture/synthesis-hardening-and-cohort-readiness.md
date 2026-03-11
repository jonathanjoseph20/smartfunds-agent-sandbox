# Synthesis Hardening and Cohort Readiness

## Scope

Sprint 2.12 hardens cross-investigation synthesis without introducing cohorts, swarms, dashboards, Slack loops, or generalized coordination graphs.

The boundary remains deterministic, CLI-first, and inspectable.

## Readiness Model

Synthesis readiness is evaluated explicitly with deterministic fields:
- `readinessState`
- `blockingReasons[]`
- `linkedInvestigationCount`
- `completedInvestigationCount`
- `unresolvedConflictCount`
- `strengths[]`
- `limitations[]`

Readiness states:
- `pending`
- `active`
- `incomplete`
- `inconclusive`
- `ready`
- `completed`

`completed` is reserved for explicit materialization.

## Conflict Classification

Conflict classes are bounded and deterministic:
- `direct_finding_conflict`
- `confidence_mismatch`
- `support_imbalance`
- `unresolved_component_limitations`
- `incomplete_component_dependency`

Each conflict includes deterministic IDs and sorted investigation/finding references.

## Link Explanations

Each linked investigation exposes deterministic link explanations:
- `shared_protocol`
- `shared_asset`
- `shared_event_family`
- `shared_trigger_family`
- `synthesis_definition_match`

Reasons are derived from synthesis definition eligibility, subject key normalization, and structured investigation/signal metadata.

## Projection vs Materialization

Projection is default:
- computes readiness
- computes conflicts
- computes report preview
- does not persist artifacts

Materialization is explicit:
- writes report/status/conflicts artifacts
- preserves projection object immutability
- uses deterministic runtime paths

## Runtime Hygiene

Runtime artifacts are normalized under:

`artifacts/syntheses/<synthesisId>/`

Files:
- `synthesis-report.json`
- `synthesis-report.md`
- `synthesis-status.json`
- `synthesis-conflicts.json`

No generated runtime artifacts are written into source-controlled definition directories.

## Cohort Readiness

This hardening layer is the substrate for future cohort primitives.
No cohort abstractions are introduced in this sprint.
