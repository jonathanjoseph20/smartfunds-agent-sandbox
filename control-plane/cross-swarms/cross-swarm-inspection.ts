import {
  createCrossSwarmHistoryStore,
  resolveCrossSwarmArtifactPaths,
  type CrossSwarmHistoryStore
} from './cross-swarm-history.ts';
import {
  createCrossSwarmLinker,
  type CrossSwarmLinker
} from './cross-swarm-linker.ts';
import {
  createCrossSwarmMaterializer,
  type CrossSwarmMaterializer
} from './cross-swarm-materializer.ts';
import {
  createCrossSwarmRegistry,
  type CrossSwarmRegistry
} from './cross-swarm-registry.ts';
import {
  createCrossSwarmStatusProjection,
  type CrossSwarmStatusProjectionEngine
} from './cross-swarm-status.ts';
import type { CrossSwarmProjection, CrossSwarmStatusProjection } from './cross-swarm-types.ts';

function toProgressReason(status: CrossSwarmStatusProjection): string {
  if (status.lifecycleState === 'progressing') {
    return 'cross_swarm_lifecycle_progressing';
  }
  if (status.lifecycleState === 'active') {
    return 'cross_swarm_active';
  }
  return 'cross_swarm_initialized';
}

function toReadinessReason(status: CrossSwarmStatusProjection): string {
  if (status.readinessState === 'blocked') {
    return status.blockers.join('|') || 'cross_swarm_blocked';
  }
  if (status.readinessState === 'coherent') {
    return 'cross_swarm_coherent';
  }
  return 'cross_swarm_analyzing';
}

function toProjection(input: {
  status: CrossSwarmStatusProjection;
  historyStore: CrossSwarmHistoryStore;
  artifactsRoot?: string;
}): CrossSwarmProjection {
  const history = input.historyStore.load(input.status.crossSwarmId);
  const artifactPaths = resolveCrossSwarmArtifactPaths({
    crossSwarmId: input.status.crossSwarmId,
    rootDir: input.artifactsRoot
  });

  const statusPreview = {
    crossSwarmId: input.status.crossSwarmId,
    lifecycleState: input.status.lifecycleState,
    readinessState: input.status.readinessState,
    completion: input.status.completion,
    blockers: input.status.blockers,
    conflicts: input.status.conflicts,
    linkedSwarmIds: input.status.linkedSwarmIds
  } as Record<string, unknown>;

  const reportPreview = {
    ...input.status,
    history
  } as Record<string, unknown>;

  return {
    ...input.status,
    historySummary: {
      totalEvents: history.entries.length,
      ...(history.entries[0] ? { lastEventType: history.entries[0].eventType } : {}),
      ...(history.entries[0] ? { lastEventDedupeKey: history.entries[0].eventDedupeKey } : {})
    },
    artifactPaths,
    statusPreview,
    reportPreview
  };
}

export function createCrossSwarmInspection(options: {
  registry?: CrossSwarmRegistry;
  linker?: CrossSwarmLinker;
  projection?: CrossSwarmStatusProjectionEngine;
  materializer?: CrossSwarmMaterializer;
  historyStore?: CrossSwarmHistoryStore;
  definitionsDir?: string;
  swarmDefinitionsDir?: string;
  teamDefinitionsDir?: string;
  cohortDefinitionsDir?: string;
  cohortProgramDefinitionsDir?: string;
  cohortArtifactsRoot?: string;
  investigationsRootDir?: string;
  investigationArtifactsRoot?: string;
  investigationDefinitionsDir?: string;
  signalsRootDir?: string;
  synthesisDefinitionsDir?: string;
  synthesisArtifactsRoot?: string;
  policyDefinitionsDir?: string;
  coordinationArtifactsRoot?: string;
  teamSwarmArtifactsRoot?: string;
  swarmArtifactsRoot?: string;
  crossSwarmArtifactsRoot?: string;
  now?: () => Date;
} = {}) {
  const registry = options.registry ?? createCrossSwarmRegistry({ definitionsDir: options.definitionsDir });
  const linker = options.linker ?? createCrossSwarmLinker({
    registry,
    definitionsDir: options.definitionsDir,
    swarmDefinitionsDir: options.swarmDefinitionsDir,
    teamDefinitionsDir: options.teamDefinitionsDir,
    cohortDefinitionsDir: options.cohortDefinitionsDir,
    cohortProgramDefinitionsDir: options.cohortProgramDefinitionsDir,
    cohortArtifactsRoot: options.cohortArtifactsRoot,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    policyDefinitionsDir: options.policyDefinitionsDir,
    coordinationArtifactsRoot: options.coordinationArtifactsRoot,
    teamSwarmArtifactsRoot: options.teamSwarmArtifactsRoot,
    swarmArtifactsRoot: options.swarmArtifactsRoot,
    now: options.now
  });
  const historyStore = options.historyStore ?? createCrossSwarmHistoryStore({
    artifactsRoot: options.crossSwarmArtifactsRoot
  });
  const projection = options.projection ?? createCrossSwarmStatusProjection({
    registry,
    linker,
    definitionsDir: options.definitionsDir,
    swarmDefinitionsDir: options.swarmDefinitionsDir,
    teamDefinitionsDir: options.teamDefinitionsDir,
    cohortDefinitionsDir: options.cohortDefinitionsDir,
    cohortProgramDefinitionsDir: options.cohortProgramDefinitionsDir,
    cohortArtifactsRoot: options.cohortArtifactsRoot,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    policyDefinitionsDir: options.policyDefinitionsDir,
    coordinationArtifactsRoot: options.coordinationArtifactsRoot,
    teamSwarmArtifactsRoot: options.teamSwarmArtifactsRoot,
    swarmArtifactsRoot: options.swarmArtifactsRoot,
    now: options.now
  });
  const materializer = options.materializer ?? createCrossSwarmMaterializer({
    projection,
    crossSwarmArtifactsRoot: options.crossSwarmArtifactsRoot,
    definitionsDir: options.definitionsDir,
    swarmDefinitionsDir: options.swarmDefinitionsDir,
    teamDefinitionsDir: options.teamDefinitionsDir,
    cohortDefinitionsDir: options.cohortDefinitionsDir,
    cohortProgramDefinitionsDir: options.cohortProgramDefinitionsDir,
    cohortArtifactsRoot: options.cohortArtifactsRoot,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    policyDefinitionsDir: options.policyDefinitionsDir,
    coordinationArtifactsRoot: options.coordinationArtifactsRoot,
    teamSwarmArtifactsRoot: options.teamSwarmArtifactsRoot,
    swarmArtifactsRoot: options.swarmArtifactsRoot,
    now: options.now
  });

  function listCrossSwarms() {
    return registry.listDefinitions().map((entry) => ({
      crossSwarmId: entry.crossSwarmId,
      displayName: entry.displayName,
      groupType: entry.groupType,
      enabled: entry.enabled
    }));
  }

  function inspectCrossSwarm(crossSwarmId: string): CrossSwarmProjection {
    const status = projection.projectOne(crossSwarmId);
    return toProjection({
      status,
      historyStore,
      artifactsRoot: options.crossSwarmArtifactsRoot
    });
  }

  function getCrossSwarmStatus(crossSwarmId: string) {
    const status = projection.projectOne(crossSwarmId);
    return {
      crossSwarmId,
      lifecycleState: status.lifecycleState,
      readinessState: status.readinessState,
      completion: status.completion,
      blockers: status.blockers,
      conflicts: status.conflicts,
      strengths: status.strengths,
      limitations: status.limitations
    };
  }

  function getCrossSwarmLinks(crossSwarmId: string) {
    const link = linker.buildLinks().find((entry) => entry.crossSwarmId === crossSwarmId);
    if (!link) {
      throw new Error(`CROSS_SWARM_NOT_FOUND: ${crossSwarmId}`);
    }

    return {
      crossSwarmId,
      linkedSwarmIds: link.linkedSwarmIds,
      linkedSwarms: link.linkedSwarms,
      rationale: link.rationale
    };
  }

  function getCrossSwarmReadiness(crossSwarmId: string) {
    const status = projection.projectOne(crossSwarmId);
    return {
      crossSwarmId,
      readinessState: status.readinessState,
      blockers: status.blockers,
      conflicts: status.conflicts,
      strengths: status.strengths,
      limitations: status.limitations
    };
  }

  function getCrossSwarmHistory(crossSwarmId: string) {
    registry.getDefinition(crossSwarmId);
    return historyStore.load(crossSwarmId);
  }

  function evaluateCrossSwarm(input: { crossSwarmId: string; slotReference?: string }) {
    const status = projection.projectOne(input.crossSwarmId);

    historyStore.append({
      crossSwarmId: input.crossSwarmId,
      eventType: 'cross_swarm_initialized',
      reason: 'cross_swarm_projection_generated',
      lifecycleState: status.lifecycleState,
      readinessState: status.readinessState,
      completionSatisfied: status.completion.isComplete,
      linkedSwarmIds: status.linkedSwarmIds,
      blockers: status.blockers,
      conflicts: status.conflicts,
      ...(input.slotReference ? { slotReference: input.slotReference } : {})
    });

    if (status.linkedSwarmIds.length > 0) {
      historyStore.append({
        crossSwarmId: input.crossSwarmId,
        eventType: 'swarm_linked',
        reason: `linked_swarms:${String(status.linkedSwarmIds.length)}`,
        lifecycleState: status.lifecycleState,
        readinessState: status.readinessState,
        completionSatisfied: status.completion.isComplete,
        linkedSwarmIds: status.linkedSwarmIds,
        blockers: status.blockers,
        conflicts: status.conflicts,
        ...(input.slotReference ? { slotReference: input.slotReference } : {})
      });
    }

    historyStore.append({
      crossSwarmId: input.crossSwarmId,
      eventType: 'readiness_changed',
      reason: toReadinessReason(status),
      lifecycleState: status.lifecycleState,
      readinessState: status.readinessState,
      completionSatisfied: status.completion.isComplete,
      linkedSwarmIds: status.linkedSwarmIds,
      blockers: status.blockers,
      conflicts: status.conflicts,
      ...(input.slotReference ? { slotReference: input.slotReference } : {})
    });

    if (status.lifecycleState === 'active' || status.lifecycleState === 'progressing' || status.lifecycleState === 'initializing') {
      historyStore.append({
        crossSwarmId: input.crossSwarmId,
        eventType: 'coordination_progressed',
        reason: toProgressReason(status),
        lifecycleState: status.lifecycleState,
        readinessState: status.readinessState,
        completionSatisfied: status.completion.isComplete,
        linkedSwarmIds: status.linkedSwarmIds,
        blockers: status.blockers,
        conflicts: status.conflicts,
        ...(input.slotReference ? { slotReference: input.slotReference } : {})
      });
    }

    if (status.lifecycleState === 'stabilizing') {
      historyStore.append({
        crossSwarmId: input.crossSwarmId,
        eventType: 'coordination_stabilized',
        reason: status.conflicts.join('|') || 'cross_swarm_stabilizing',
        lifecycleState: status.lifecycleState,
        readinessState: status.readinessState,
        completionSatisfied: status.completion.isComplete,
        linkedSwarmIds: status.linkedSwarmIds,
        blockers: status.blockers,
        conflicts: status.conflicts,
        ...(input.slotReference ? { slotReference: input.slotReference } : {})
      });
    }

    if (status.completion.isComplete) {
      historyStore.append({
        crossSwarmId: input.crossSwarmId,
        eventType: 'coordination_completed',
        reason: 'cross_swarm_completion_requirements_satisfied',
        lifecycleState: status.lifecycleState,
        readinessState: status.readinessState,
        completionSatisfied: status.completion.isComplete,
        linkedSwarmIds: status.linkedSwarmIds,
        blockers: status.blockers,
        conflicts: status.conflicts,
        ...(input.slotReference ? { slotReference: input.slotReference } : {})
      });
    }

    return {
      projection: inspectCrossSwarm(input.crossSwarmId),
      history: historyStore.load(input.crossSwarmId)
    };
  }

  function materializeCrossSwarm(crossSwarmId: string) {
    const projected = inspectCrossSwarm(crossSwarmId);
    const materialized = materializer.materializeProjection({ projection: projected });
    historyStore.write(historyStore.load(crossSwarmId));
    return {
      ...materialized,
      historyPath: projected.artifactPaths.historyJsonPath
    };
  }

  return {
    listCrossSwarms,
    inspectCrossSwarm,
    getCrossSwarmStatus,
    getCrossSwarmLinks,
    getCrossSwarmReadiness,
    getCrossSwarmHistory,
    evaluateCrossSwarm,
    materializeCrossSwarm
  };
}

export type CrossSwarmInspection = ReturnType<typeof createCrossSwarmInspection>;
