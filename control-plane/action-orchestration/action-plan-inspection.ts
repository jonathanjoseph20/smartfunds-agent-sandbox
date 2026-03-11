import {
  createActionPlanHistoryStore,
  type ActionPlanHistoryStore,
} from './action-plan-history-store.ts';
import {
  createActionPlanLinker,
  type ActionPlanLinker,
} from './action-plan-linker.ts';
import {
  createActionPlanMaterializer,
  type ActionPlanMaterializer,
} from './action-plan-materializer.ts';
import {
  createActionPlanProjection,
  type ActionPlanProjectionEngine,
} from './action-plan-projection.ts';
import {
  createActionPlanRegistry,
  type ActionPlanRegistry,
} from './action-plan-registry.ts';
import {
  createActionPlanStatusProjection,
  type ActionPlanStatusProjectionEngine,
} from './action-plan-status.ts';

function toReadinessReason(readinessState: string, blockers: string[]): string {
  if (readinessState === 'blocked') {
    return blockers.join('|') || 'action_plan_readiness_blocked';
  }

  if (readinessState === 'coherent') {
    return 'action_plan_readiness_coherent';
  }

  if (readinessState === 'analyzing') {
    return 'action_plan_readiness_analyzing';
  }

  return 'action_plan_readiness_pending';
}

function toLifecycleReason(lifecycleState: string): string {
  if (lifecycleState === 'progressing') {
    return 'action_plan_lifecycle_progressing';
  }

  if (lifecycleState === 'active') {
    return 'action_plan_lifecycle_active';
  }

  if (lifecycleState === 'initializing') {
    return 'action_plan_lifecycle_initializing';
  }

  if (lifecycleState === 'stabilizing') {
    return 'action_plan_lifecycle_stabilizing';
  }

  return 'action_plan_initialized';
}

export function createActionPlanInspection(options: {
  registry?: ActionPlanRegistry;
  linker?: ActionPlanLinker;
  statusProjection?: ActionPlanStatusProjectionEngine;
  projection?: ActionPlanProjectionEngine;
  materializer?: ActionPlanMaterializer;
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

  let linker = options.linker;
  let statusProjection = options.statusProjection;
  let projection = options.projection;
  let materializer = options.materializer;

  const historyStore = options.historyStore ?? createActionPlanHistoryStore({
    artifactsRoot: options.actionPlanArtifactsRoot,
  });

  function getLinker(): ActionPlanLinker {
    linker ??= createActionPlanLinker({
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
    return linker;
  }

  function getStatusProjection(): ActionPlanStatusProjectionEngine {
    statusProjection ??= createActionPlanStatusProjection({
      registry,
      linker: getLinker(),
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
    return statusProjection;
  }

  function getProjection(): ActionPlanProjectionEngine {
    projection ??= createActionPlanProjection({
      registry,
      statusProjection: getStatusProjection(),
      historyStore,
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
      actionPlanArtifactsRoot: options.actionPlanArtifactsRoot,
      now: options.now,
    });
    return projection;
  }

  function getMaterializer(): ActionPlanMaterializer {
    materializer ??= createActionPlanMaterializer({
      projection: getProjection(),
      historyStore,
      actionPlanArtifactsRoot: options.actionPlanArtifactsRoot,
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
    return materializer;
  }

  function listPlans() {
    return registry.getActionPlanDefinitions().map((entry) => ({
      actionPlanId: entry.actionPlanId,
      displayName: entry.displayName,
      planType: entry.planType,
      enabled: entry.enabled,
    }));
  }

  function inspectPlan(actionPlanId: string) {
    return getProjection().projectOne(actionPlanId);
  }

  function getPlanStatus(actionPlanId: string) {
    const projected = inspectPlan(actionPlanId);
    return {
      actionPlanId,
      lifecycleState: projected.lifecycleState,
      readinessState: projected.readinessState,
      completionState: projected.completionState,
      priority: projected.priority,
      routeSummary: projected.routeSummary,
      linkedActionIds: projected.linkedActionIds,
      blockingReasons: projected.blockingReasons,
      strengths: projected.strengths,
      limitations: projected.limitations,
    };
  }

  function getPlanLinks(actionPlanId: string) {
    const link = getLinker().buildLinks().find((entry) => entry.actionPlanId === actionPlanId);
    if (!link) {
      throw new Error(`ACTION_PLAN_NOT_FOUND: ${actionPlanId}`);
    }

    return {
      actionPlanId,
      linkedActionIds: link.linkedActionIds,
      linkedActions: link.linkedActions,
      rationale: link.rationale,
      riskThemes: link.riskThemes,
      routeCategories: link.routeCategories,
    };
  }

  function getPlanReadiness(actionPlanId: string) {
    const projected = inspectPlan(actionPlanId);
    return {
      actionPlanId,
      readinessState: projected.readinessState,
      completionState: projected.completionState,
      blockingReasons: projected.blockingReasons,
      strengths: projected.strengths,
      limitations: projected.limitations,
    };
  }

  function getPlanPriority(actionPlanId: string) {
    const projected = inspectPlan(actionPlanId);
    return {
      actionPlanId,
      priority: projected.priority,
      routeSummary: projected.routeSummary,
      reasons: projected.priorityReasons,
    };
  }

  function getPlanHistory(actionPlanId: string) {
    registry.getActionPlanDefinitionById(actionPlanId);
    return historyStore.load(actionPlanId);
  }

  function evaluateActionPlan(input: { actionPlanId: string; slotReference?: string }) {
    const status = getStatusProjection().projectOne(input.actionPlanId);

    historyStore.append({
      actionPlanId: input.actionPlanId,
      eventType: 'action_plan_initialized',
      reason: 'action_plan_projection_generated',
      linkedActionIds: status.linkedActionIds,
      ...(input.slotReference ? { slotReference: input.slotReference } : {}),
    });

    if (status.linkedActionIds.length > 0) {
      historyStore.append({
        actionPlanId: input.actionPlanId,
        eventType: 'action_candidate_linked',
        reason: `linked_action_candidates:${String(status.linkedActionIds.length)}`,
        linkedActionIds: status.linkedActionIds,
        ...(input.slotReference ? { slotReference: input.slotReference } : {}),
      });
    }

    historyStore.append({
      actionPlanId: input.actionPlanId,
      eventType: 'readiness_changed',
      reason: toReadinessReason(status.readinessState, status.blockingReasons),
      linkedActionIds: status.linkedActionIds,
      ...(input.slotReference ? { slotReference: input.slotReference } : {}),
    });

    historyStore.append({
      actionPlanId: input.actionPlanId,
      eventType: 'priority_changed',
      reason: status.priorityReasons.join('|') || 'priority_evaluated',
      linkedActionIds: status.linkedActionIds,
      ...(input.slotReference ? { slotReference: input.slotReference } : {}),
    });

    if (status.lifecycleState === 'initializing' || status.lifecycleState === 'active' || status.lifecycleState === 'progressing' || status.lifecycleState === 'stabilizing') {
      historyStore.append({
        actionPlanId: input.actionPlanId,
        eventType: 'plan_progressed',
        reason: toLifecycleReason(status.lifecycleState),
        linkedActionIds: status.linkedActionIds,
        ...(input.slotReference ? { slotReference: input.slotReference } : {}),
      });
    }

    if (status.completionState === 'completed') {
      historyStore.append({
        actionPlanId: input.actionPlanId,
        eventType: 'plan_completed',
        reason: 'action_plan_intelligence_stabilized',
        linkedActionIds: status.linkedActionIds,
        ...(input.slotReference ? { slotReference: input.slotReference } : {}),
      });
    }

    if (status.completionState === 'inconclusive') {
      historyStore.append({
        actionPlanId: input.actionPlanId,
        eventType: 'plan_marked_inconclusive',
        reason: status.limitations.join('|') || 'action_plan_completion_inconclusive',
        linkedActionIds: status.linkedActionIds,
        ...(input.slotReference ? { slotReference: input.slotReference } : {}),
      });
    }

    return {
      projection: inspectPlan(input.actionPlanId),
      history: historyStore.load(input.actionPlanId),
    };
  }

  return {
    listPlans,
    inspectPlan,
    getPlanStatus,
    getPlanLinks,
    getPlanReadiness,
    getPlanPriority,
    getPlanHistory,
    evaluateActionPlan,
    materializeOne: (actionPlanId: string) => getMaterializer().materializeOne(actionPlanId),
  };
}

export type ActionPlanInspection = ReturnType<typeof createActionPlanInspection>;
