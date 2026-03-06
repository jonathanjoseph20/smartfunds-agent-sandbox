# Agent Profiles Runbook

## Purpose

Agent profiles define deterministic, granular member behavior for mission teams.

Profiles are loaded from:

- `control-plane/agents/profiles/`

## Required Schema Sections

Each profile must include:

- `agentId`, `displayName`, `role`, `projectId`, `adapterType`
- `personalityProfile`
- `skillsProfile`
- `backgroundProfile`
- `outputProfile`
- `constraintsProfile`
- `toolProfile`

## Adapter and Tool Rules

Validation enforces:

- `adapterType` is supported (`llm`, `repo`, `shell`)
- `toolProfile.allowedAdapters` contains only supported adapters
- `adapterType` is included in `allowedAdapters`
- `preferredTools` is a subset of `allowedAdapters`
- `preferredTools` and `forbiddenTools` do not overlap

## Best Practices

- Keep profile language explicit and operational.
- Encode constraints in `mustDo` and `mustNotDo` lists.
- Keep output styles consistent with workflow deliverables.
- Prefer stable, reusable identifiers (`agentId`) across missions.

## Validation and Inspection

Inspect team + member compatibility:

```bash
npm run team:inspect -- --team smartfunds-research-team
```

Run profile tests:

```bash
npx vitest run control-plane/agents/agent-profile-validator.test.ts control-plane/agents/agent-profile-loader.test.ts
```
