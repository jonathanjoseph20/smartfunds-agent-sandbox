# Mission Runner Runbook

## Define a Mission

Create a mission file in `control-plane/missions/definitions/`.

Required fields:

- `missionId`
- `projectId`
- `teamId`
- `workflowId`
- `objective`

Team and agent references must resolve from:

- `control-plane/teams/definitions/`
- `control-plane/agents/profiles/`

## Run a Mission

```bash
npm run mission:run -- --mission rwa-market-analysis
```

Expected behavior:

- loads mission contract
- resolves team and agent roster
- validates mission/team/agent coherence
- seeds execution context metadata (`missionId`, `teamId`, `agentRoster`)
- invokes existing swarm runner
- prints deterministic JSON result

## Inspect a Mission Contract

```bash
npm run mission:inspect -- --mission rwa-market-analysis
```

Output includes:

- mission summary
- workflow id
- team summary
- agent roster summary
- initial context

## Failure Patterns

- missing mission file: `Mission definition not found: <id>`
- missing team file: `Team definition not found: <id>`
- missing agent profile references: validation error with missing ids
- project mismatch between mission and team: coherence validation error

## Determinism Rules

- mission configs are file-defined and immutable
- roster ordering is stable
- no runtime generation of mission/team identity
- CLI output is canonical JSON
