import { getRailProfile, loadRailsRegistry, type RailProfile } from '../entities/rails.ts';
import { loadEntityRegistry } from '../studio/entity-registry.ts';
import { canonicalStringify, sha256 } from './determinism.ts';
import type { SettlementAdapter, SettlementResult } from './adapters/types.ts';
import type { SettlementLogEntry, SettlementLogStore } from './settlement-log.ts';

export type ChargeIntentStatus = 'CREATED' | 'EXECUTED' | 'FAILED';

export type ChargeIntent = {
  intentId: string;
  entityId: string;
  railProfileId: RailProfile;
  amount: string;
  currency: string;
  counterparty: string;
  purpose: string;
  metadata?: Record<string, string>;
  status: ChargeIntentStatus;
  determinismHash: string;
};

export type ChargeIntentInput = {
  intentId?: string;
  entityId: string;
  railProfileId: RailProfile;
  amount: string;
  currency: string;
  counterparty: string;
  purpose: string;
  metadata?: Record<string, string>;
};

export type ChargeIntentCore = {
  entityId: string;
  railProfileId: RailProfile;
  amount: string;
  currency: string;
  counterparty: string;
  purpose: string;
  metadata?: Record<string, string>;
};

type ChargeIntentValidationOptions = {
  entityRegistryPath?: string;
  projectsDir?: string;
  railsRegistryPath?: string;
};

function buildIntentCore(input: ChargeIntentInput): ChargeIntentCore {
  return {
    entityId: input.entityId,
    railProfileId: input.railProfileId,
    amount: input.amount,
    currency: input.currency,
    counterparty: input.counterparty,
    purpose: input.purpose,
    ...(input.metadata ? { metadata: input.metadata } : {})
  };
}

export function buildChargeIntentHash(core: ChargeIntentCore): string {
  return sha256(canonicalStringify(core));
}

function requireEntity(entityId: string, options: ChargeIntentValidationOptions): void {
  const registry = loadEntityRegistry({ registryPath: options.entityRegistryPath, projectsDir: options.projectsDir });
  const hasEntity = registry.entities.some((entity) => entity.entityId === entityId);
  if (!hasEntity) {
    throw new Error(`ERR_ENTITY_NOT_FOUND: ${entityId}`);
  }
}

function requireRailProfile(entityId: string, railProfileId: RailProfile, options: ChargeIntentValidationOptions): void {
  const registry = loadRailsRegistry({ registryPath: options.railsRegistryPath });
  const mappedProfile = getRailProfile(entityId, registry);
  if (!mappedProfile) {
    throw new Error(`ERR_RAIL_PROFILE_MISSING: ${entityId}`);
  }
  if (mappedProfile !== railProfileId) {
    throw new Error(`ERR_RAIL_PROFILE_INCOMPATIBLE: ${entityId}`);
  }
}

export function createChargeIntent(
  input: ChargeIntentInput,
  options: ChargeIntentValidationOptions = {}
): ChargeIntent {
  requireEntity(input.entityId, options);
  requireRailProfile(input.entityId, input.railProfileId, options);

  const core = buildIntentCore(input);
  const determinismHash = buildChargeIntentHash(core);
  const intentId = input.intentId ?? `ci_${determinismHash.slice(0, 12)}`;

  return {
    intentId,
    ...core,
    status: 'CREATED',
    determinismHash
  };
}

export function executeChargeIntent(
  intent: ChargeIntent,
  adapter: SettlementAdapter,
  log: SettlementLogStore
): { updatedIntent: ChargeIntent; result: SettlementResult; logEntry: SettlementLogEntry } {
  const result = adapter.execute(intent);
  const updatedIntent: ChargeIntent = {
    ...intent,
    status: result.outcome === 'EXECUTED' ? 'EXECUTED' : 'FAILED'
  };
  const logEntry = log.appendFromResult(intent.determinismHash, result);

  return { updatedIntent, result, logEntry };
}
