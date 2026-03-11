# Investigation Completion And Convergence

## Scope

Sprint 2.10 adds deterministic, single-investigation completion signaling after revision updates.

This layer is:
- additive
- deterministic
- rule-based
- CLI inspectable

This layer is not:
- cross-investigation coordination
- swarms
- dashboards
- Slack alerting
- AI judgment

## Layer Position

runtime
-> scheduler
-> persistent research runtime
-> signal bus
-> trigger layer
-> investigation layer
-> investigation scheduler integration
-> evidence + confidence
-> continuity + revision
-> completion + convergence

## Status Model

Readiness states:
- `ready_to_finalize`
- `still_evolving`
- `blocked`
- `inconclusive`
- `complete`
- `unhealthy`

Convergence states:
- `converging`
- `stable`
- `still_evolving`
- `diverging`
- `inconclusive`

Health states:
- `healthy`
- `waiting_normally`
- `retrying`
- `blocked_by_missing_evidence`
- `degraded_by_counter_evidence`
- `stalled`
- `inconclusive`

## Deterministic Convergence Rules

- `inconclusive`: insufficient revision history
- `diverging`: confidence decreases or counter-evidence added
- `stable`: last 3 revisions keep confidence unchanged and findings unchanged
- `converging`: confidence improves/stays flat and no new critical gaps/counter-evidence
- `still_evolving`: material finding changes or other non-terminal movement

## Deterministic Health Rules

- `healthy`: investigation active with accumulating support and no critical gaps
- `waiting_normally`: lifecycle is waiting on deterministic dataset update
- `retrying`: retry lifecycle active
- `blocked_by_missing_evidence`: critical evidence gaps remain
- `degraded_by_counter_evidence`: counter evidence degrades confidence
- `stalled`: multiple cycles without revision movement
- `inconclusive`: contradictory/mixed evidence signals

## Completion Evaluation Rules

Readiness is derived from:
- convergence state
- health state
- lifecycle progress
- confidence threshold criteria
- evidence and gap criteria
- required phase criteria

Blocking reasons use structured codes:
- `critical_gap_unresolved`
- `confidence_below_threshold`
- `required_phase_incomplete`
- `recent_counter_evidence_added`
- `awaiting_dataset_update`
- `awaiting_additional_cycle_confirmation`

## Finalization Signals

Signals emitted on state transition only:
- `investigation_ready_to_finalize`
- `investigation_completed`
- `investigation_inconclusive`
- `investigation_stalled`
- `investigation_confidence_degraded`

Deduplication is deterministic via persisted prior completion status and signal fingerprints.

## Persistence

Each revision may include:
- `completion-status.json`

`revision-summary.json` records `completionStatusPath`.

Completion signal events are appended to investigation history and do not alter lifecycle transitions.

