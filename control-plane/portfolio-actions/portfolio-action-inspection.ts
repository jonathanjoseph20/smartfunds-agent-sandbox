import {
  createPortfolioActionHistoryStore,
  resolvePortfolioActionArtifactPaths,
  type PortfolioActionHistoryStore,
} from './portfolio-action-history-store.ts';
import {
  createPortfolioActionLinker,
  type PortfolioActionLinker,
} from './portfolio-action-linker.ts';
import {
  createPortfolioActionRegistry,
  type PortfolioActionRegistry,
} from './portfolio-action-registry.ts';
import {
  createPortfolioActionStatusProjection,
  type PortfolioActionStatusProjectionEngine,
} from './portfolio-action-status.ts';
import type {
  PortfolioActionProjection,
} from './portfolio-action-types.ts';

function toReadinessReason(readinessState: string, blockers: string[]): string {
  if (readinessState === 'blocked') {
    return blockers.join('|') || 'action_readiness_blocked';
  }
  if (readinessState === 'ready') {
    return 'action_readiness_ready';
  }
  if (readinessState === 'analyzing') {
    return 'action_readiness_analyzing';
  }
  return 'action_readiness_pending';
}

function toLifecycleReason(lifecycleState: string): string {
  if (lifecycleState === 'progressing') {
    return 'action_lifecycle_progressing';
  }
  if (lifecycleState === 'active') {
    return 'action_lifecycle_active';
  }
  if (lifecycleState === 'initializing') {
    return 'action_lifecycle_initializing';
  }
  if (lifecycleState === 'stabilizing') {
    return 'action_lifecycle_stabilizing';
  }
  return 'action_initialized';
}

function toProjection(input: {
  status: ReturnType<PortfolioActionStatusProjectionEngine['projectOne']>;
  historyStore: PortfolioActionHistoryStore;
  artifactsRoot?: string;
}): PortfolioActionProjection {
  const history = input.historyStore.load(input.status.actionId);

  const artifactPaths = resolvePortfolioActionArtifactPaths({
    actionId: input.status.actionId,
    rootDir: input.artifactsRoot,
  });

  const statusPreview = {
    actionId: input.status.actionId,
    lifecycleState: input.status.lifecycleState,
    readinessState: input.status.readinessState,
    completionState: input.status.completionState,
    priority: input.status.priority,
    routeCategory: input.status.routeCategory,
    linkedPortfolioIds: input.status.linkedPortfolioIds,
    blockingReasons: input.status.blockingReasons,
    riskThemes: input.status.riskThemes,
    strengths: input.status.strengths,
    limitations: input.status.limitations,
  } as Record<string, unknown>;

  const reportPreview = {
    ...input.status,
    history,
  } as Record<string, unknown>;

  return {
    ...input.status,
    historySummary: {
      totalEvents: history.entries.length,
      ...(history.entries[0] ? { lastEventType: history.entries[0].eventType } : {}),
      ...(history.entries[0] ? { lastEventDedupeKey: history.entries[0].eventDedupeKey } : {}),
    },
    artifactPaths,
    statusPreview,
    reportPreview,
  };
}

export function createPortfolioActionInspection(options: {
  registry?: PortfolioActionRegistry;
  linker?: PortfolioActionLinker;
  statusProjection?: PortfolioActionStatusProjectionEngine;
  historyStore?: PortfolioActionHistoryStore;
  definitionsDir?: string;
  portfolioActionDefinitionsDir?: string;
  portfolioDefinitionsDir?: string;
  marketSynthesisDefinitionsDir?: string;
  crossSwarmDefinitionsDir?: string;
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
  marketSynthesisArtifactsRoot?: string;
  portfolioArtifactsRoot?: string;
  portfolioActionArtifactsRoot?: string;
  now?: () => Date;
} = {}) {
  const definitionsDir = options.definitionsDir ?? options.portfolioActionDefinitionsDir;

  const registry = options.registry ?? createPortfolioActionRegistry({ definitionsDir });

  const linker = options.linker ?? createPortfolioActionLinker({
    registry,
    definitionsDir,
    portfolioDefinitionsDir: options.portfolioDefinitionsDir,
    marketSynthesisDefinitionsDir: options.marketSynthesisDefinitionsDir,
    crossSwarmDefinitionsDir: options.crossSwarmDefinitionsDir,
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
    crossSwarmArtifactsRoot: options.crossSwarmArtifactsRoot,
    marketSynthesisArtifactsRoot: options.marketSynthesisArtifactsRoot,
    portfolioArtifactsRoot: options.portfolioArtifactsRoot,
    now: options.now,
  });

  const statusProjection = options.statusProjection ?? createPortfolioActionStatusProjection({
    registry,
    linker,
    definitionsDir,
    portfolioDefinitionsDir: options.portfolioDefinitionsDir,
    marketSynthesisDefinitionsDir: options.marketSynthesisDefinitionsDir,
    crossSwarmDefinitionsDir: options.crossSwarmDefinitionsDir,
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
    crossSwarmArtifactsRoot: options.crossSwarmArtifactsRoot,
    marketSynthesisArtifactsRoot: options.marketSynthesisArtifactsRoot,
    portfolioArtifactsRoot: options.portfolioArtifactsRoot,
    now: options.now,
  });

  const historyStore = options.historyStore ?? createPortfolioActionHistoryStore({
    artifactsRoot: options.portfolioActionArtifactsRoot,
  });

  function listPortfolioActions() {
    return registry.getActionDefinitions().map((entry) => ({
      actionId: entry.actionId,
      displayName: entry.displayName,
      actionType: entry.actionType,
      enabled: entry.enabled,
    }));
  }

  function inspectPortfolioAction(actionId: string) {
    const status = statusProjection.projectOne(actionId);
    return toProjection({
      status,
      historyStore,
      artifactsRoot: options.portfolioActionArtifactsRoot,
    });
  }

  function getPortfolioActionStatus(actionId: string) {
    const projected = inspectPortfolioAction(actionId);
    return {
      actionId,
      lifecycleState: projected.lifecycleState,
      readinessState: projected.readinessState,
      completionState: projected.completionState,
      priority: projected.priority,
      routeCategory: projected.routeCategory,
      linkedPortfolioIds: projected.linkedPortfolioIds,
      blockingReasons: projected.blockingReasons,
      riskThemes: projected.riskThemes,
      strengths: projected.strengths,
      limitations: projected.limitations,
    };
  }

  function getPortfolioActionLinks(actionId: string) {
    const link = linker.buildLinks().find((entry) => entry.actionId === actionId);
    if (!link) {
      throw new Error(`PORTFOLIO_ACTION_NOT_FOUND: ${actionId}`);
    }

    return {
      actionId,
      linkedPortfolioIds: link.linkedPortfolioIds,
      linkedPortfolios: link.linkedPortfolios,
      riskThemes: link.riskThemes,
      exposureFlags: link.exposureFlags,
      concentrationWarnings: link.concentrationWarnings,
      rationale: link.rationale,
    };
  }

  function getPortfolioActionReadiness(actionId: string) {
    const projected = inspectPortfolioAction(actionId);
    return {
      actionId,
      readinessState: projected.readinessState,
      completionState: projected.completionState,
      blockingReasons: projected.blockingReasons,
      strengths: projected.strengths,
      limitations: projected.limitations,
    };
  }

  function getPortfolioActionPriority(actionId: string) {
    const projected = inspectPortfolioAction(actionId);
    return {
      actionId,
      priority: projected.priority,
      routeCategory: projected.routeCategory,
      reasons: projected.priorityReasons,
      riskThemes: projected.riskThemes,
      concentrationWarnings: projected.concentrationWarnings,
    };
  }

  function getPortfolioActionHistory(actionId: string) {
    registry.getActionDefinitionById(actionId);
    return historyStore.load(actionId);
  }

  function evaluatePortfolioAction(input: { actionId: string; slotReference?: string }) {
    const status = statusProjection.projectOne(input.actionId);

    historyStore.append({
      actionId: input.actionId,
      eventType: 'action_initialized',
      reason: 'portfolio_action_projection_generated',
      linkedPortfolioIds: status.linkedPortfolioIds,
      readinessState: status.readinessState,
      completionState: status.completionState,
      priority: status.priority,
      routeCategory: status.routeCategory,
      ...(input.slotReference ? { slotReference: input.slotReference } : {}),
    });

    if (status.linkedPortfolioIds.length > 0) {
      historyStore.append({
        actionId: input.actionId,
        eventType: 'portfolio_linked',
        reason: `linked_portfolios:${String(status.linkedPortfolioIds.length)}`,
        linkedPortfolioIds: status.linkedPortfolioIds,
        readinessState: status.readinessState,
        completionState: status.completionState,
        priority: status.priority,
        routeCategory: status.routeCategory,
        ...(input.slotReference ? { slotReference: input.slotReference } : {}),
      });
    }

    historyStore.append({
      actionId: input.actionId,
      eventType: 'readiness_changed',
      reason: toReadinessReason(status.readinessState, status.blockingReasons),
      linkedPortfolioIds: status.linkedPortfolioIds,
      readinessState: status.readinessState,
      completionState: status.completionState,
      priority: status.priority,
      routeCategory: status.routeCategory,
      ...(input.slotReference ? { slotReference: input.slotReference } : {}),
    });

    historyStore.append({
      actionId: input.actionId,
      eventType: 'priority_changed',
      reason: status.priorityReasons.join('|') || 'priority_evaluated',
      linkedPortfolioIds: status.linkedPortfolioIds,
      readinessState: status.readinessState,
      completionState: status.completionState,
      priority: status.priority,
      routeCategory: status.routeCategory,
      ...(input.slotReference ? { slotReference: input.slotReference } : {}),
    });

    if (status.lifecycleState === 'initializing' || status.lifecycleState === 'active' || status.lifecycleState === 'progressing' || status.lifecycleState === 'stabilizing') {
      historyStore.append({
        actionId: input.actionId,
        eventType: 'action_progressed',
        reason: toLifecycleReason(status.lifecycleState),
        linkedPortfolioIds: status.linkedPortfolioIds,
        readinessState: status.readinessState,
        completionState: status.completionState,
        priority: status.priority,
        routeCategory: status.routeCategory,
        ...(input.slotReference ? { slotReference: input.slotReference } : {}),
      });
    }

    if (status.completionState === 'completed') {
      historyStore.append({
        actionId: input.actionId,
        eventType: 'action_completed',
        reason: 'action_intelligence_stabilized',
        linkedPortfolioIds: status.linkedPortfolioIds,
        readinessState: status.readinessState,
        completionState: status.completionState,
        priority: status.priority,
        routeCategory: status.routeCategory,
        ...(input.slotReference ? { slotReference: input.slotReference } : {}),
      });
    }

    if (status.completionState === 'inconclusive') {
      historyStore.append({
        actionId: input.actionId,
        eventType: 'action_marked_inconclusive',
        reason: status.limitations.join('|') || 'action_completion_inconclusive',
        linkedPortfolioIds: status.linkedPortfolioIds,
        readinessState: status.readinessState,
        completionState: status.completionState,
        priority: status.priority,
        routeCategory: status.routeCategory,
        ...(input.slotReference ? { slotReference: input.slotReference } : {}),
      });
    }

    return {
      projection: inspectPortfolioAction(input.actionId),
      history: historyStore.load(input.actionId),
    };
  }

  return {
    listPortfolioActions,
    inspectPortfolioAction,
    getPortfolioActionStatus,
    getPortfolioActionLinks,
    getPortfolioActionReadiness,
    getPortfolioActionPriority,
    getPortfolioActionHistory,
    evaluatePortfolioAction,
  };
}

export type PortfolioActionInspection = ReturnType<typeof createPortfolioActionInspection>;
