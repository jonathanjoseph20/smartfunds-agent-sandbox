import {
  createActionPlanHistoryStore,
  resolveActionPlanArtifactPaths,
  type ActionPlanHistoryStore,
} from './action-plan-history-store.ts';
import {
  createActionPlanRegistry,
  type ActionPlanRegistry,
} from './action-plan-registry.ts';
import {
  createActionPlanStatusProjection,
  type ActionPlanStatusProjectionEngine,
} from './action-plan-status.ts';
import type {
  ActionPlanProjection,
  ActionPlanStatusProjection,
} from './action-plan-types.ts';

function toProjection(input: {
  status: ActionPlanStatusProjection;
  historyStore: ActionPlanHistoryStore;
  artifactsRoot?: string;
}): ActionPlanProjection {
  const history = input.historyStore.load(input.status.actionPlanId);

  const artifactPaths = resolveActionPlanArtifactPaths({
    actionPlanId: input.status.actionPlanId,
    rootDir: input.artifactsRoot,
  });

  const statusPreview = {
    actionPlanId: input.status.actionPlanId,
    lifecycleState: input.status.lifecycleState,
    readinessState: input.status.readinessState,
    completionState: input.status.completionState,
    priority: input.status.priority,
    routeSummary: input.status.routeSummary,
    linkedActionIds: input.status.linkedActionIds,
    blockingReasons: input.status.blockingReasons,
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
    },
    artifactPaths,
    statusPreview,
    reportPreview,
  };
}

export function createActionPlanProjection(options: {
  registry?: ActionPlanRegistry;
  statusProjection?: ActionPlanStatusProjectionEngine;
  historyStore?: ActionPlanHistoryStore;
  definitionsDir?: string;
  actionPlanDefinitionsDir?: string;
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
  actionPlanArtifactsRoot?: string;
  now?: () => Date;
} = {}) {
  const definitionsDir = options.definitionsDir ?? options.actionPlanDefinitionsDir;

  const registry = options.registry ?? createActionPlanRegistry({ definitionsDir });

  const statusProjection = options.statusProjection ?? createActionPlanStatusProjection({
    registry,
    definitionsDir,
    portfolioActionDefinitionsDir: options.portfolioActionDefinitionsDir,
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
    portfolioActionArtifactsRoot: options.portfolioActionArtifactsRoot,
    now: options.now,
  });

  const historyStore = options.historyStore ?? createActionPlanHistoryStore({
    artifactsRoot: options.actionPlanArtifactsRoot,
  });

  function projectOne(actionPlanId: string): ActionPlanProjection {
    registry.getActionPlanDefinitionById(actionPlanId);
    const status = statusProjection.projectOne(actionPlanId);
    return toProjection({
      status,
      historyStore,
      artifactsRoot: options.actionPlanArtifactsRoot,
    });
  }

  function projectAll(): ActionPlanProjection[] {
    return registry
      .getActionPlanDefinitions()
      .map((entry) => projectOne(entry.actionPlanId))
      .sort((left, right) => left.actionPlanId.localeCompare(right.actionPlanId));
  }

  return {
    projectOne,
    projectAll,
  };
}

export type ActionPlanProjectionEngine = ReturnType<typeof createActionPlanProjection>;
