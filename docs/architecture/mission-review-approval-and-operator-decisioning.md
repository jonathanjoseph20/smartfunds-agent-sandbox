# Mission Review, Approval, and Operator Decisioning (Sprint 7.3)

## Scope
Sprint 7.3 adds a deterministic, append-only, projection-first governance layer above mission coordination.

This layer answers:
- Does a mission require review?
- What queue entry is active?
- What decision posture exists now?
- Which append-only events explain that posture?

## Bounded Model
Core objects:
- `MissionReviewQueueEntry`
- `MissionGovernanceStatus`
- `OperatorDecisionRecord`
- `MissionReviewRequirement`
- `MissionDecisionOutcome`
- `MissionDecisionHistory`

All identities are deterministic hashes over canonical payloads. No timestamps, randomness, process metadata, or environment metadata are used in identity payloads.

## Data Flow
1. Mission coordination projection provides lifecycle, priority, escalation, and dependency posture.
2. Mission review history provides append-only review/decision events.
3. Mission review projection derives:
- requirement surfaces
- queue entry and queue state
- decision outcome
- governance status

Materialization only persists projection output and does not redefine truth.

## Deterministic Precedence
Decision/outcome precedence is explicit and replay-safe:
- terminal outcomes (`rejected`, `approved`) dominate governance state
- `changes_requested`, `deferred`, and `review_escalated` are bounded outcomes
- if no decision exists, requirement+queue posture determines awaiting/under-review states

Queue/requirement precedence is explicit and bounded:
- one active queue entry per mission run + requirement posture cycle
- closure increments deterministic queue cycle and produces a new deterministic queue identity

## Append-Only History
History events are append-only and semantically deduped via deterministic dedupe key.

Event types:
- `mission_review_queued`
- `mission_review_started`
- `mission_review_deferred`
- `mission_decision_recorded`
- `mission_approved`
- `mission_rejected`
- `mission_changes_requested`
- `mission_review_escalated`
- `mission_review_closed`

## Relationship To Mission Coordination
Mission review consumes mission coordination projection and does not mutate coordination semantics.

No runtime/task-execution/worker/scheduling behavior is modified by this layer.

## Non-Goals
This sprint does not implement:
- dashboards
- notifications
- portfolio governance
- scheduler/runtime mutation
- external ticketing/workflow systems
