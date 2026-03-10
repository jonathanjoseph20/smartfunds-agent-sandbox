# Autonomous Research Agents

## Scope

Sprint 2.6 adds a bounded autonomous investigation substrate above triggers and below any future higher-order agent systems.

This layer is:
- definition-driven
- deterministic
- bounded to explicit ordered phases
- inspection-friendly
- a consumer of trigger-derived launch requests

This layer is not:
- a swarm system
- a generalized orchestration engine
- free-form autonomy
- a dashboard milestone

## Layer Position

The control-plane progression remains:

runtime
-> scheduler
-> persistent research
-> signal bus
-> trigger layer
-> investigation layer

Signals and triggers retain authority for detection and launch-request generation. Investigations consume those launch requests after prior-layer persistence succeeds.

## Investigation Definitions

Investigation definitions live under `control-plane/investigations/definitions/` and are loaded in deterministic filename and definition ID order.

Each definition declares:
- `investigationDefinitionId`
- `sourceSignalType` and/or `sourceTriggerId`
- ordered phases
- output artifact expectations
- completion criteria
- dedupe strategy

Phase kinds are fixed for this sprint:
- `intake`
- `gather`
- `analyze`
- `synthesize`
- `finalize`

There is no planner loop, no open-ended branching, and no generalized DAG support in this layer.

## Registry And Resolution

`createInvestigationRegistry()` validates seeded JSON definitions and resolves the matching investigation definition for a trigger-derived launch request using explicit trigger and signal context.

Resolution is deterministic:
- definitions are loaded in stable order
- duplicate definition IDs fail fast
- matching returns a single explicit definition

## State Model

Investigation state is projected from append-only events stored under `investigations/<logDate>/investigation-events.json`.

Projected state includes:
- investigation run identity
- dedupe identity
- definition identity
- source signal reference
- source trigger reference and trigger ID when present
- status
- current phase
- completed phases
- artifact paths
- final report path
- associated mission references
- findings
- failure reason when present

Statuses are:
- `pending`
- `running`
- `blocked`
- `completed`
- `failed`
- `cancelled`

The current sprint uses `pending`, `running`, `completed`, and `failed`.

## Dedupe Model

Duplicate suppression is first-class and deterministic.

The dedupe identity is derived from:
- `investigationDefinitionId`
- `sourceSignalReference`
- `slot`

The dedupe key and run ID are hashed from canonical JSON, so the same triggering condition cannot create repeated investigations while a different slot can create a distinct run.

## Execution Flow

Execution is bounded and sequential:

1. Signal is persisted.
2. Trigger engine persists trigger output and returns launch requests.
3. Investigation executor resolves the source signal and matching investigation definition.
4. The executor creates investigation state.
5. Phases run in fixed order.
6. Intermediate artifacts are written under `artifacts/investigations/<investigationRunId>/`.
7. A deterministic JSON report and markdown report are generated.
8. Final state is projected as completed or failed.

Investigation failures are passive. They do not change signal persistence or trigger persistence semantics.

## Runtime Reuse Boundary

The executor records and carries forward associated mission references from the originating trigger launch request and phase definitions. This keeps the investigation layer aligned with existing mission/runtime contracts without introducing a second execution substrate or generalized mission orchestration stack.

## Intermediate Findings

Each phase writes deterministic artifacts with stable file names, for example:
- `intake-context.json`
- `gather-evidence.json`
- `analyze-assessment.json`
- `synthesize-findings.json`

Artifact paths are appended to state and rendered in inspection and report outputs.

## Final Reports

Completed investigations emit:
- `investigation-report.json`
- `investigation-report.md`

Reports include:
- investigation identity
- source signal and trigger context
- phase summary
- artifact references
- findings
- conclusion
- deterministic next-step recommendations

Report generation is template-driven and rule-based for this sprint.

## Operator Surfaces

Operators can inspect investigations with:
- `npm run investigations:list`
- `npm run investigations:inspect -- --investigation <id>`
- `npm run investigations:history`
- `npm run investigations:report -- --investigation <id>`

These surfaces mirror existing signals and triggers inspection patterns and emit stable output.

## Future Compatibility

This layer is the bounded autonomous investigation substrate for later research-agent and swarm-like systems, without introducing generalized orchestration in Sprint 2.6.

## Sprint 2.7 Integration

Long-running scheduler-aware lifecycle progression is documented in:
- `docs/architecture/investigation-scheduler-integration.md`
