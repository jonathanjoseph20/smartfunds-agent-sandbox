# Mission Assignment Operations

## Scope

This runbook covers Sprint 4.3 mission assignment operations.

This layer is deterministic and pre-execution.

## Evaluate Assignment

```bash
npm run mission-assignment:evaluate -- --mission <missionId>
```

Optional policy override:

```bash
npm run mission-assignment:evaluate -- --mission <missionId> --policy <policyId>
```

Computes ranked candidates, selected team (if available), decision state, and records assignment evaluation history.

## Inspect Assignment

```bash
npm run mission-assignment:inspect -- --mission <missionId>
```

Returns full assignment projection including decision fields, candidates, alternatives, and history summary.

## Status View

```bash
npm run mission-assignment:status -- --mission <missionId>
```

Returns status-only assignment payload.

## History View

```bash
npm run mission-assignment:history -- --mission <missionId>
```

Returns append-only assignment history for the mission’s current assignment decision.

## Materialize Assignment Artifacts

```bash
npm run mission-assignment:materialize -- --mission <missionId>
```

Writes projection artifacts to:

- `artifacts/mission-assignment/<assignmentDecisionId>/assignment-status.json`
- `artifacts/mission-assignment/<assignmentDecisionId>/assignment-report.json`
- `artifacts/mission-assignment/<assignmentDecisionId>/assignment-report.md`
- `artifacts/mission-assignment/<assignmentDecisionId>/assignment-history.json`
- `artifacts/mission-assignment/<assignmentDecisionId>/assignment-candidates.json`

## Confirm Assignment

```bash
npm run mission-assignment:confirm -- --mission <missionId>
```

Records `assignment_confirmed` in assignment history. This does not activate mission execution.

## Founder Override

```bash
npm run mission-assignment:override -- \
  --mission <missionId> \
  --team <teamId> \
  --reason-file <path>
```

Optional reviewer + policy:

```bash
npm run mission-assignment:override -- \
  --mission <missionId> \
  --team <teamId> \
  --reason-file <path> \
  --reviewed-by <reviewerId> \
  --policy <policyId>
```

Notes:

- override team must be in evaluated candidate set
- override produces a new assignment decision record
- override does not mutate compatibility truth

## Diagnose Blocked/Under-Review Decisions

1. Inspect assignment status and `decisionReason`.
2. Check `blockingReasons` for manual review triggers:
   - `tie_among_top_candidates`
   - `top_candidate_manual_only`
   - `top_candidate_restricted`
   - `no_strong_match`
   - `founder_confirmation_required`
3. Inspect ranked candidates and policy score classes.
4. Confirm no mission/team truth mutation (assignment layer is projection/history/artifact only).

## Command Reference

- `mission-assignment:list`
- `mission-assignment:inspect -- --mission <missionId>`
- `mission-assignment:status -- --mission <missionId>`
- `mission-assignment:history -- --mission <missionId>`
- `mission-assignment:materialize -- --mission <missionId>`
- `mission-assignment:evaluate -- --mission <missionId> [--policy <policyId>]`
- `mission-assignment:confirm -- --mission <missionId> [--policy <policyId>]`
- `mission-assignment:override -- --mission <missionId> --team <teamId> --reason-file <path> [--reviewed-by <reviewerId>] [--policy <policyId>]`

## Sprint 4.3 Boundaries

Not supported in this sprint:

- mission activation
- team invocation
- scheduling
- task graph execution
- runtime orchestration
