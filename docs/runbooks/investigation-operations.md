# Investigation Operations

## What This Layer Does

The investigation layer starts bounded follow-up research runs from trigger-derived launch requests.

It is:
- deterministic
- definition-driven
- phase-bounded
- operator-inspectable

It is not:
- a swarm system
- generalized autonomy
- a dashboard workflow

## How Investigations Start

Investigations start passively after:
1. a signal is emitted and persisted
2. the trigger layer evaluates that signal
3. a trigger-derived launch request is created and persisted

Only then does the investigation executor consume the launch request.

If investigation startup fails, the earlier signal and trigger records remain valid and unchanged.

## Investigation Phases

Sprint 2.6 uses a fixed ordered phase set:
1. `intake`
2. `gather`
3. `analyze`
4. `synthesize`
5. `finalize`

Operators should interpret them as:
- `intake`: source context confirmed
- `gather`: source evidence collected into deterministic artifacts
- `analyze`: source evidence converted into structured assessment
- `synthesize`: findings assembled into stable summaries
- `finalize`: final report artifacts written

## Investigation Status

The main statuses are:
- `running`: phase execution is in progress
- `completed`: all phases finished and final report artifacts exist
- `failed`: a bounded phase failed and failure state was persisted

Failure is terminal for this sprint. Operators should inspect the current phase and failure reason before re-running upstream conditions.

## Duplicate Suppression

Duplicate suppression uses a deterministic identity derived from:
- investigation definition
- source signal reference
- slot

This means:
- the same triggering condition does not start multiple investigations
- a later slot can start a new investigation when upstream conditions create a distinct signal

## Artifact Locations

Intermediate and final outputs are written under:

`artifacts/investigations/<investigationRunId>/`

Typical artifacts include:
- `intake-context.json`
- `gather-evidence.json`
- `analyze-assessment.json`
- `synthesize-findings.json`
- `investigation-report.json`
- `investigation-report.md`

## CLI Commands

List investigations:

```bash
npm run investigations:list
```

Inspect a single investigation:

```bash
npm run investigations:inspect -- --investigation <investigationRunId>
```

View grouped history:

```bash
npm run investigations:history
```

Read the final markdown report:

```bash
npm run investigations:report -- --investigation <investigationRunId>
```

## What Operators Should Check

From the CLI, operators can answer:
- what investigations exist
- what signal and trigger started them
- which phase is current
- whether the run completed or failed
- which artifacts were produced
- where the final report lives
- what the conclusion was

## Failure Interpretation

If an investigation is `failed`:
- inspect the `currentPhaseId`
- inspect the `failureReason`
- confirm upstream signal and trigger persistence still occurred
- re-run only after the triggering condition or deterministic phase inputs are understood

## Future Compatibility Note

This layer is the bounded autonomous investigation substrate for later research-agent and swarm-like systems, without yet introducing generalized orchestration.

For scheduler-integrated multi-cycle lifecycle operations, see:
- `docs/runbooks/long-running-investigations.md`
