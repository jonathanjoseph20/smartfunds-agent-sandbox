import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import { createChargeIntent, executeChargeIntent, type ChargeIntentInput } from '../finance/charge-intent.ts';
import { createSettlementLogStore } from '../finance/settlement-log.ts';
import { resolveAdapter } from '../finance/adapters/registry.ts';
import { assertAdapterAllowedForMode } from '../finance/adapters/policy.ts';
import type { SettlementAdapterId } from '../finance/adapters/types.ts';
import type { EntityRegistryEntry } from '../studio/entity-registry.ts';
import type { RailProfileEntry } from '../entities/rails.ts';
import { appendSwarmLog } from './log.ts';
import { getSwarm, normalizeSwarmDefinition } from './registry.ts';
import type { SwarmRunInput, SwarmRunResult, SwarmStepResult, SwarmDefinition, SwarmStep } from './types.ts';

const CHARGE_INTENT_TYPE = 'ChargeIntent';

type ChargeIntentEnvelope = {
  type: typeof CHARGE_INTENT_TYPE;
  intent: ChargeIntentInput;
  adapterId: SettlementAdapterId;
  registrySnapshot?: {
    entityRegistry: EntityRegistryEntry[];
    railsRegistry: { version: 1; entities: RailProfileEntry[] };
  };
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizePayload(payload: unknown): unknown {
  return JSON.parse(canonicalStringify(payload));
}

function buildStepOutput(step: SwarmStep, payload: unknown): unknown {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const payloadRecord = payload as Record<string, unknown>;
    if (step.action === 'emit-charge-intent' && payloadRecord.chargeIntentEnvelope) {
      return payloadRecord.chargeIntentEnvelope;
    }
  }

  return {
    type: 'SwarmStepOutput',
    roleId: step.roleId,
    action: step.action,
    payloadEcho: normalizePayload(payload)
  };
}

function findChargeIntentEnvelope(output: unknown): ChargeIntentEnvelope | null {
  if (!output || typeof output !== 'object') {
    return null;
  }
  const record = output as Record<string, unknown>;
  if (record.type !== CHARGE_INTENT_TYPE) {
    return null;
  }
  if (!record.intent || typeof record.intent !== 'object') {
    return null;
  }
  if (!isNonEmptyString(record.adapterId)) {
    return null;
  }

  const envelope = record as ChargeIntentEnvelope;
  if (envelope.registrySnapshot) {
    if (!Array.isArray(envelope.registrySnapshot.entityRegistry)) {
      return null;
    }
    if (!envelope.registrySnapshot.railsRegistry || envelope.registrySnapshot.railsRegistry.version !== 1) {
      return null;
    }
  }

  return envelope;
}

function buildRunId(input: SwarmRunInput): string {
  return sha256(canonicalStringify({ swarmId: input.swarmId, payload: input.payload }));
}

function executeChargeIntentEnvelope(definition: SwarmDefinition, envelope: ChargeIntentEnvelope): unknown {
  const intent = createChargeIntent(envelope.intent, {
    entityRegistry: envelope.registrySnapshot?.entityRegistry,
    railsRegistry: envelope.registrySnapshot?.railsRegistry
  });
  const adapter = resolveAdapter(envelope.adapterId);
  assertAdapterAllowedForMode(adapter, definition.mode);
  const log = createSettlementLogStore();
  const { updatedIntent, result, logEntry } = executeChargeIntent(intent, adapter, log);

  return {
    intent: updatedIntent,
    result,
    logEntry
  };
}

export function runSwarm(input: SwarmRunInput): SwarmRunResult {
  if (!isNonEmptyString(input.swarmId)) {
    throw new Error('ERR_SWARM_ID_REQUIRED');
  }

  const definition = normalizeSwarmDefinition(getSwarm(input.swarmId));
  const runId = buildRunId(input);

  const stepResults: SwarmStepResult[] = [];
  let chargeIntentReceipt: unknown | undefined;

  for (const step of definition.steps) {
    const output = buildStepOutput(step, input.payload);
    const outputHash = sha256(canonicalStringify(output));

    appendSwarmLog({
      runId,
      stepIndex: step.stepIndex,
      roleId: step.roleId,
      outputHash,
      status: 'ok'
    });

    stepResults.push({
      stepIndex: step.stepIndex,
      roleId: step.roleId,
      output,
      outputHash
    });

    if (!chargeIntentReceipt) {
      const envelope = findChargeIntentEnvelope(output);
      if (envelope) {
        chargeIntentReceipt = executeChargeIntentEnvelope(definition, envelope);
      }
    }
  }

  return {
    runId,
    swarmId: definition.swarmId,
    mode: definition.mode,
    stepResults,
    ...(chargeIntentReceipt ? { chargeIntentReceipt } : {})
  };
}
