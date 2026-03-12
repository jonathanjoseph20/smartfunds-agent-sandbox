# Team Compatibility Operations

## Scope

This runbook covers Sprint 4.2 Team Capability & Assignment Readiness operations.

This sprint is pre-assignment and pre-execution.

## List Compatibility Sets

```bash
npm run team-compatibility:list
```

Returns deterministic summaries:

- `compatibilitySetId`
- `missionId`
- `compatibilityState`
- `supportedTeamCount`
- `blockedTeamCount`

## Inspect Compatibility for a Mission

```bash
npm run team-compatibility:inspect -- --mission <missionId>
```

Returns the full compatibility projection, including candidate teams and rationale tokens.

## Status View

```bash
npm run team-compatibility:status -- --mission <missionId>
```

Returns the status-only compatibility projection.

## History View

```bash
npm run team-compatibility:history -- --mission <missionId>
```

Returns append-only compatibility history for the mission’s current compatibility set.

## Materialize Compatibility Artifacts

```bash
npm run team-compatibility:materialize -- --mission <missionId>
```

Writes deterministic artifacts to:

- `artifacts/team-compatibility/<compatibilitySetId>/compatibility-status.json`
- `artifacts/team-compatibility/<compatibilitySetId>/compatibility-report.json`
- `artifacts/team-compatibility/<compatibilitySetId>/compatibility-report.md`
- `artifacts/team-compatibility/<compatibilitySetId>/compatibility-history.json`

## Manual Smoke Test

Persist a real mission instance from a template into the mission registry:

```bash
cat >/tmp/produce-market-memo-params.json <<'JSON'
{
  "market_topic": "RWA settlement",
  "geography": "US",
  "timeframe": "next 12 months"
}
JSON

npm run mission-templates:instantiate -- \
  --template produce-market-memo \
  --params-file /tmp/produce-market-memo-params.json \
  --write
```

Use the returned `missionId` with compatibility commands:

```bash
npm run team-compatibility:list
npm run team-compatibility:inspect -- --mission <missionId>
npm run team-compatibility:status -- --mission <missionId>
npm run team-compatibility:history -- --mission <missionId>
npm run team-compatibility:materialize -- --mission <missionId>
```

The instantiate command writes to the same mission instance registry source consumed by the compatibility layer.

## Interpreting Candidate Output

- `compatibilityClass` is structural fit classification.
- `assignmentReadiness` is pre-assignment readiness posture.
- `matchReasons` and `blockingReasons` explain deterministic rule outcomes.
- `limitations` indicate manual or incomplete constraints.

## Diagnosing Blocked/Unsupported/Inconclusive

- blocked: hard lifecycle/availability/readiness contradictions.
- unsupported: mission type/template support mismatch.
- inconclusive: conflicting or unresolved readiness signals.

## Sprint 4.2 Non-Goals

This layer does not:

- assign teams
- route winners
- activate missions
- schedule work
- invoke runtime execution
