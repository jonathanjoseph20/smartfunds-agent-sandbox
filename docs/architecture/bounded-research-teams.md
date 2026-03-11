# Bounded Research Teams

## Scope

Sprint 2.16 introduces deterministic bounded research teams as a response container layer above cohorts, monitoring programs, investigations, and synthesis.

This layer is:
- deterministic
- projection-first
- append-only for team history
- inspectable via CLI
- materialized as stable artifacts

This layer is not:
- swarm orchestration
- agent assignment
- DAG planning
- dashboards
- Slack automation

## Model

A research team definition is an explicit JSON registry entry with:
- `teamId`
- `displayName`
- `teamType`
- `enabled`
- explicit `attachmentRules`

Allowed attachment rule keys:
- `cohortIds`
- `cohortTypes`
- `subjectFamilies`
- `topicCategories`

Attachment uses explicit rule matches only. No fuzzy matching is used.

## Status Model

Team status is derived from lower-layer projections only. Team state never rewrites cohort/program/investigation/synthesis truth.

Activity states:
- `inactive`
- `monitoring`
- `active_response`
- `escalated_response`
- `stable`
- `paused`

Health states:
- `idle`
- `healthy`
- `active`
- `overloaded`
- `conflicted`
- `unstable`

Status derivation inputs include:
- cohort readiness/health/escalation projections
- linked program ids
- linked investigation completion health
- linked synthesis conflict projections

## History Model

Team history is append-only and deduped by deterministic event identity.

History events:
- `team_attached`
- `team_activated`
- `team_deactivated`
- `team_escalated`
- `team_stabilized`

Equivalent event envelopes are deduped with canonical hashing.

## Artifacts

Per-team materialization path:
- `artifacts/research-teams/<teamId>/team-status.json`
- `artifacts/research-teams/<teamId>/team-history.json`
- `artifacts/research-teams/<teamId>/team-report.md`

Materialization persists projections and history snapshots only. It does not mutate lower-layer truth.

## Relation To Future Swarms

Bounded research teams are a stable ownership/response substrate for future swarm systems.

Swarms remain out of scope for this sprint.
