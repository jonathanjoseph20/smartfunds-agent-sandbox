# Swarm v1

Swarm v1 is a deterministic orchestration kernel that registers a swarm definition and runs ordered steps without any LLM or network calls. It produces a stable run log and can optionally emit a ChargeIntent envelope for mock settlement.

## Determinism Rules
- No timestamps, randomness, or environment-dependent values.
- Stable ordering: roles sorted by `roleId`, steps sorted by `stepIndex`.
- Hashes use canonical JSON normalization + SHA-256 from `control-plane/finance/determinism.ts`.

## Registering a Swarm
Create a `SwarmDefinition` and register it via `registerSwarm`. Duplicates are rejected and stored definitions are frozen.

## Running a Swarm
`runSwarm({ swarmId, payload })` computes a deterministic `runId` and executes steps in order. Each step produces a deterministic output and an appended swarm log entry.

### ChargeIntent Integration
ChargeIntent execution is triggered only by an explicit envelope output:
```
{
  "type": "ChargeIntent",
  "adapterId": "stripe_mock",
  "intent": { ...ChargeIntentInput },
  "registrySnapshot": {
    "entityRegistry": [ ... ],
    "railsRegistry": { "version": 1, "entities": [ ... ] }
  }
}
```
The `adapterId` lives only in the envelope and does not affect ChargeIntent hashing or IDs.

## Mode Policy
Each adapter declares `allowedModes`. When a swarm emits a ChargeIntent, the adapter registry resolves the adapter, and the mode policy rejects any mode not in `allowedModes` with `ERR_ADAPTER_MODE_FORBIDDEN`.
