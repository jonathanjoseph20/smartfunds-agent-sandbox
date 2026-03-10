# Persistent Research Runtime

## Purpose

Sprint 2.3 productizes the scheduler foundation from Sprint 2.2 into a persistent research runtime.

The runtime keeps scheduled missions scheduler-native while adding deterministic research continuity:

- persistent research team registry
- mission pack grouping by schedule IDs
- rolling artifact accumulation into team-owned namespaces
- longitudinal datasets for cross-run memory
- deterministic synthesis into executive summary artifacts
- operator inspection surfaces for teams, packs, datasets, and summaries

## Relationship to Prior Sprints

- Sprint 2.1: hardened workflow/runtime behavior
- Sprint 2.2: deterministic mission scheduler (cadence, due evaluation, duplicate-safe slots, launch history)
- Sprint 2.3: research control-plane layer above scheduler without changing scheduler due/launch contracts

## Architecture

### Research Team Layer

Research teams are deterministic JSON definitions in:

- `control-plane/research/teams/*.json`

Current team:

- `defi-intelligence`

Team contract includes:

- `teamId`
- `missionPackId`
- `description`
- optional `datasetKeys`
- optional `summaryArtifactPath`
- optional `enabled`

### Mission Pack Layer

Mission packs are deterministic JSON definitions in:

- `control-plane/research/packs/*.json`

A mission pack is a schedule grouping only (not a workflow engine).

Current pack:

- `defi-intelligence`

Pack behavior:

- references scheduler `scheduleId` values
- validates schedule membership against scheduler registry
- maps schedules to artifact namespaces
- defines optional `summaryScheduleId` for periodic synthesis

### Scheduler Integration

`createSchedulerService(...)` now accepts an optional `onLaunchRecord` hook.

- hook is invoked after each launch record is finalized
- hook failures are swallowed to preserve scheduler contracts
- no change to due evaluation, history semantics, or scheduler result shape

Research runtime uses this hook from `research-scheduler-tick` command.

## Artifact Accumulation Model

Accumulation reads mission outputs from:

- `artifacts/<missionId>/<runId>/...`

It writes team-owned copies to:

- `artifacts/<teamId>/<namespace>/<slotId>__<runId>__<filename>`

State and idempotency records:

- `artifacts/<teamId>/_state/processed-launches.json`
- `artifacts/<teamId>/_state/accumulated-artifacts.json`

Duplicate prevention key:

- `scheduleId + slotId + runId`

If the same launch is processed twice, accumulation is skipped deterministically.

## Longitudinal Datasets

Datasets are durable, deterministic JSON files under:

- `artifacts/<teamId>/datasets/*.json`

Current dataset keys:

- `protocol_tvl_timeseries`
- `yield_rate_history`
- `governance_vote_tracker`

Merge semantics:

- deterministic row normalization
- deterministic dedupe key based on stable schedule/run/data payload
- deterministic sorted output

## Synthesis Model

Synthesis reads longitudinal datasets and writes:

- structured summary JSON
- markdown operator report

Output paths:

- `artifacts/<teamId>/daily-briefs/defi-daily-intelligence-<reportDate>.json`
- `artifacts/<teamId>/daily-briefs/defi-daily-intelligence-<reportDate>.md`
- `artifacts/<teamId>/daily-briefs/latest-summary.json`

Markdown sections are fixed and deterministic:

1. Liquidity Highlights
2. Yield Movements
3. Governance Events
4. Risk Signals
5. Watchlist / Follow-ups

Empty sections render `None` deterministically.

## Operator Inspection

CLI inspection surfaces:

- `research:teams:list`
- `research:team:inspect`
- `research:packs:list`
- `research:pack:inspect`
- `research:datasets:inspect`
- `research:summary:inspect`

Scheduler + research processing command:

- `research:scheduler:tick`

## Determinism Guarantees

- stable ordering in all registry loads and outputs
- canonical JSON serialization for persisted control-plane artifacts
- deterministic dataset merge behavior
- no random IDs, no UUIDs, no timestamp-based identity
- scheduler slot identity remains the primary runtime identity source

## Future Extension Boundary

This sprint intentionally does not add:

- signal bus
- triggered autonomous missions
- swarm orchestration expansion
- Slack automation
- ranking/ML reasoning layers

The runtime is prepared for future signal-driven workflows while remaining scheduler-native and deterministic.
