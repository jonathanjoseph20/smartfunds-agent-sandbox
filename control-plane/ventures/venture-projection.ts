import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import {
  createVentureHistoryStore,
  type VentureHistoryStore,
} from './venture-history-store.ts';
import {
  createVentureRegistry,
  type VentureRegistry,
} from './venture-registry.ts';
import { deriveVentureStatus } from './venture-status.ts';
import type { VentureProjection } from './venture-types.ts';

export function createVentureProjection(options: {
  registry?: VentureRegistry;
  historyStore?: VentureHistoryStore;
  definitionsDir?: string;
} = {}) {
  const registry = options.registry ?? createVentureRegistry({ definitionsDir: options.definitionsDir });
  const historyStore = options.historyStore ?? createVentureHistoryStore();

  function projectOne(ventureId: string): VentureProjection {
    const definition = registry.getVenture(ventureId);
    const validation = registry.getValidation(ventureId);
    const status = deriveVentureStatus({
      definition,
      validation,
    });

    const history = historyStore.replay({
      definition,
      status,
    });

    const historyDigest = sha256(canonicalStringify(history.entries));

    return {
      ventureId: definition.ventureId ?? '',
      ventureName: definition.ventureName,
      ventureClass: definition.ventureClass,
      ventureLifecycleState: status.ventureLifecycleState,
      ventureStatus: status.ventureStatus,
      ownershipModel: definition.ownershipModel,
      operatingMode: definition.operatingMode,
      originSummary: {
        originMissionIds: definition.originMissionIds,
        linkedMissionPortfolioIds: definition.linkedMissionPortfolioIds,
        linkedEntityIds: definition.linkedEntityIds,
      },
      linkedMissionIds: definition.originMissionIds,
      linkedTeamIds: definition.linkedTeamIds,
      limitations: status.limitations,
      blockingReasons: status.blockingReasons,
      historyDigest,
      definition,
      validation,
      history,
      summary: {
        ventureId: definition.ventureId ?? '',
        ventureName: definition.ventureName,
        ventureSlug: definition.ventureSlug,
        ventureClass: definition.ventureClass,
        ventureLifecycleState: status.ventureLifecycleState,
        ventureStatus: status.ventureStatus,
        ownershipModel: definition.ownershipModel,
        operatingMode: definition.operatingMode,
        domainTags: definition.domainTags,
        productTypeTags: definition.productTypeTags,
        jurisdictionTags: definition.jurisdictionTags,
      },
    };
  }

  function projectAll(): VentureProjection[] {
    return registry
      .listVentures()
      .map((definition) => projectOne(definition.ventureId ?? ''));
  }

  return {
    projectOne,
    projectAll,
  };
}

export type VentureProjectionEngine = ReturnType<typeof createVentureProjection>;
