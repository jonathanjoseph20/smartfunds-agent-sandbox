# Long-Running Investigations

## Purpose

Use this runbook to operate investigations that pause, wait, retry, and resume across scheduler cycles.

## Commands

List investigations:

```bash
npm run investigations:list
```

Inspect one investigation:

```bash
npm run investigations:inspect -- --investigation <investigationRunId>
```

Inspect grouped history:

```bash
npm run investigations:history
```

Inspect history for one investigation:

```bash
npm run investigations:history -- --investigation <investigationRunId>
```

List investigations due for a scheduler slot:

```bash
npm run investigations:due -- --slot <slotId>
```

Read final report:

```bash
npm run investigations:report -- --investigation <investigationRunId>
```

Inspect evidence records:

```bash
npm run investigations:evidence -- --investigation <investigationRunId>
```

Inspect confidence summary:

```bash
npm run investigations:confidence -- --investigation <investigationRunId>
```

Inspect evidence-backed findings:

```bash
npm run investigations:findings -- --investigation <investigationRunId>
```

Run scheduler with passive investigation progression:

```bash
npm run research:scheduler:tick
```

## Status Meanings

- `pending`: created, no active phase execution yet
- `running`: phase execution in progress
- `awaiting_data`: paused for deterministic data condition
- `scheduled_resume`: paused until next eligible slot
- `retry_pending`: retry scheduled for a future slot
- `blocked`: cannot progress without operator/system input
- `completed`: terminal success with final report
- `failed`: terminal failure
- `cancelled`: terminal cancellation

## Operator Checks

For each active run, confirm:
- `status`
- `currentPhaseId` / `nextPhaseId`
- `nextEligibleSlot`
- `waitingReason`
- `retryCountByPhase`
- `finalReportPath` (for completed runs)

## Due/Resume Workflow

1. Determine scheduler slot under evaluation.
2. Run `investigations:due` for that slot.
3. Execute `research:scheduler:tick` on cadence.
4. Re-check `investigations:inspect` and `investigations:history`.

## Failure And Retry Workflow

If status is `retry_pending`:
- inspect retry counts and `nextEligibleSlot`
- wait for deterministic slot progression
- verify retry transition events in history

If status is `failed`:
- inspect `failureReason` and phase history
- verify upstream signal and trigger persistence still exists
- only re-run after deterministic inputs or definitions are corrected

## History Interpretation

Use history to reconstruct:
- status transitions
- when and why waiting began
- when retry was scheduled and attempted
- which scheduler slot advanced each phase
- terminal completion/failure reason
