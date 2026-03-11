# Investigation Readiness And Finalization

## Purpose

Use this runbook to inspect deterministic readiness, convergence, and health for a single investigation run.

## Commands

Completion status:

```bash
npm run investigations:status -- --investigation <investigationRunId>
```

Convergence only:

```bash
npm run investigations:convergence -- --investigation <investigationRunId>
```

Health only:

```bash
npm run investigations:health -- --investigation <investigationRunId>
```

Completion detail:

```bash
npm run investigations:completion -- --investigation <investigationRunId>
```

Extended summary:

```bash
npm run investigations:summary -- --investigation <investigationRunId>
```

## Operator Workflow

1. Check `investigations:status` for readiness, convergence, and health.
2. If `blocked`, inspect `blockingReasons` first.
3. If `still_evolving`, run additional deterministic cycles and re-check.
4. If `inconclusive`, gather stronger supporting evidence before finalization.
5. If `ready_to_finalize`, confirm no operational blockers before final action.

## Blocking Reason Interpretation

- `critical_gap_unresolved`: critical missing evidence remains.
- `confidence_below_threshold`: confidence criterion not met.
- `required_phase_incomplete`: required investigation phases are incomplete.
- `recent_counter_evidence_added`: recent counter-evidence degraded certainty.
- `awaiting_dataset_update`: deterministic wait for upstream dataset observation.
- `awaiting_additional_cycle_confirmation`: more revision stability needed.

## State Interpretation

- `ready_to_finalize`: deterministic criteria satisfied for finalization readiness.
- `complete`: lifecycle completed and completion criteria satisfied.
- `still_evolving`: investigation continues changing materially.
- `blocked`: missing mandatory criteria or critical gaps.
- `inconclusive`: evidence quality/consistency is insufficient.
- `unhealthy`: stalled or confidence degraded by counter evidence.

## Signal Monitoring

Watch investigation history for emitted finalization transition signals:
- `investigation_ready_to_finalize`
- `investigation_completed`
- `investigation_inconclusive`
- `investigation_stalled`
- `investigation_confidence_degraded`

Signals are emitted only on deterministic state transitions and deduped across cycles.

