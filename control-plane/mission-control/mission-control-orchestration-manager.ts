import {
  createMissionControlOrchestrationHistoryStore,
  type MissionControlOrchestrationHistoryStore,
} from './mission-control-orchestration-history-store.ts';
import {
  createMissionControlOrchestrationMaterializer,
  type MissionControlOrchestrationMaterializer,
} from './mission-control-orchestration-materializer.ts';
import {
  createMissionControlOrchestrationProjection,
  type MissionControlOrchestrationProjectionEngine,
} from './mission-control-orchestration-projection.ts';
import { uniqueSortedStrings } from './mission-control-orchestration-identity.ts';

export function createMissionControlOrchestrationManager(options: {
  projection?: MissionControlOrchestrationProjectionEngine;
  historyStore?: MissionControlOrchestrationHistoryStore;
  materializer?: MissionControlOrchestrationMaterializer;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
  activationArtifactsRoot?: string;
  executionContractArtifactsRoot?: string;
  runtimeEnvelopeArtifactsRoot?: string;
  executionAttemptArtifactsRoot?: string;
  executionJournalArtifactsRoot?: string;
  executionEngineArtifactsRoot?: string;
  taskGraphArtifactsRoot?: string;
  taskExecutionArtifactsRoot?: string;
  missionControlArtifactsRoot?: string;
} = {}) {
  const historyStore = options.historyStore ?? createMissionControlOrchestrationHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  const projection = options.projection ?? createMissionControlOrchestrationProjection({
    historyStore,
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
    executionContractArtifactsRoot: options.executionContractArtifactsRoot,
    runtimeEnvelopeArtifactsRoot: options.runtimeEnvelopeArtifactsRoot,
    executionAttemptArtifactsRoot: options.executionAttemptArtifactsRoot,
    executionJournalArtifactsRoot: options.executionJournalArtifactsRoot,
    executionEngineArtifactsRoot: options.executionEngineArtifactsRoot,
    taskGraphArtifactsRoot: options.taskGraphArtifactsRoot,
    taskExecutionArtifactsRoot: options.taskExecutionArtifactsRoot,
    missionControlArtifactsRoot: options.missionControlArtifactsRoot,
  });

  const materializer = options.materializer ?? createMissionControlOrchestrationMaterializer({
    projection,
    historyStore,
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
    executionContractArtifactsRoot: options.executionContractArtifactsRoot,
    runtimeEnvelopeArtifactsRoot: options.runtimeEnvelopeArtifactsRoot,
    executionAttemptArtifactsRoot: options.executionAttemptArtifactsRoot,
    executionJournalArtifactsRoot: options.executionJournalArtifactsRoot,
    executionEngineArtifactsRoot: options.executionEngineArtifactsRoot,
    taskGraphArtifactsRoot: options.taskGraphArtifactsRoot,
    taskExecutionArtifactsRoot: options.taskExecutionArtifactsRoot,
    missionControlArtifactsRoot: options.missionControlArtifactsRoot,
  });

  function evaluateInterventionPlan(input: { missionControlInterventionPlanId: string }) {
    const projected = projection.projectOne(input);

    historyStore.appendEvent({
      missionControlInterventionPlanId: input.missionControlInterventionPlanId,
      eventType: 'mission_control_intervention_plan_created',
      reasonTokens: uniqueSortedStrings([
        `state:${projected.interventionPlan.state}`,
        `priority:${projected.interventionPlan.priority}`,
      ]),
      payload: {
        interventionPlan: projected.interventionPlan,
      },
    });

    if (projected.orchestrationQueue) {
      historyStore.appendEvent({
        missionControlInterventionPlanId: input.missionControlInterventionPlanId,
        eventType: 'mission_control_orchestration_queued',
        reasonTokens: projected.orchestrationQueue.reasonTokens,
        payload: {
          orchestrationQueue: projected.orchestrationQueue,
        },
      });
    }

    if (projected.interventionPlan.state === 'active') {
      historyStore.appendEvent({
        missionControlInterventionPlanId: input.missionControlInterventionPlanId,
        eventType: 'mission_control_orchestration_started',
        reasonTokens: uniqueSortedStrings(['state:active']),
        payload: {
          missionControlInterventionPlanId: input.missionControlInterventionPlanId,
        },
      });
    }

    for (const actionItem of projected.actionItems) {
      historyStore.appendEvent({
        missionControlInterventionPlanId: input.missionControlInterventionPlanId,
        eventType: 'mission_control_action_item_created',
        reasonTokens: actionItem.reasonTokens,
        payload: {
          actionItem,
          missionControlOrchestrationActionItemId: actionItem.missionControlOrchestrationActionItemId,
        },
      });
    }

    if (projected.interventionPlan.outcome === 'blocked') {
      historyStore.appendEvent({
        missionControlInterventionPlanId: input.missionControlInterventionPlanId,
        eventType: 'mission_control_orchestration_blocked',
        reasonTokens: projected.orchestrationOutcome.reasonTokens,
        payload: {
          orchestrationOutcome: projected.orchestrationOutcome,
        },
      });
    }

    if (projected.interventionPlan.outcome === 'completed') {
      historyStore.appendEvent({
        missionControlInterventionPlanId: input.missionControlInterventionPlanId,
        eventType: 'mission_control_orchestration_completed',
        reasonTokens: projected.orchestrationOutcome.reasonTokens,
        payload: {
          orchestrationOutcome: projected.orchestrationOutcome,
        },
      });
    }

    return projection.projectOne(input);
  }

  function deferInterventionPlan(input: {
    missionControlInterventionPlanId: string;
    reasonTokens?: string[];
  }) {
    const projected = projection.projectOne({ missionControlInterventionPlanId: input.missionControlInterventionPlanId });
    for (const actionItem of projected.actionItems.filter((entry) => entry.state !== 'completed')) {
      historyStore.appendEvent({
        missionControlInterventionPlanId: input.missionControlInterventionPlanId,
        eventType: 'mission_control_action_item_deferred',
        reasonTokens: uniqueSortedStrings([...(input.reasonTokens ?? []), ...actionItem.reasonTokens]),
        payload: {
          missionControlOrchestrationActionItemId: actionItem.missionControlOrchestrationActionItemId,
          actionClass: actionItem.actionClass,
        },
      });
    }

    return projection.projectOne({ missionControlInterventionPlanId: input.missionControlInterventionPlanId });
  }

  function markInterventionPlanActive(input: {
    missionControlInterventionPlanId: string;
    reasonTokens?: string[];
  }) {
    historyStore.appendEvent({
      missionControlInterventionPlanId: input.missionControlInterventionPlanId,
      eventType: 'mission_control_orchestration_started',
      reasonTokens: uniqueSortedStrings(['state:active', ...(input.reasonTokens ?? [])]),
      payload: {
        missionControlInterventionPlanId: input.missionControlInterventionPlanId,
      },
    });

    return projection.projectOne({ missionControlInterventionPlanId: input.missionControlInterventionPlanId });
  }

  function markInterventionPlanComplete(input: {
    missionControlInterventionPlanId: string;
    reasonTokens?: string[];
  }) {
    const projected = projection.projectOne({ missionControlInterventionPlanId: input.missionControlInterventionPlanId });

    for (const actionItem of projected.actionItems) {
      historyStore.appendEvent({
        missionControlInterventionPlanId: input.missionControlInterventionPlanId,
        eventType: 'mission_control_action_item_completed',
        reasonTokens: uniqueSortedStrings([...(input.reasonTokens ?? []), ...actionItem.reasonTokens]),
        payload: {
          missionControlOrchestrationActionItemId: actionItem.missionControlOrchestrationActionItemId,
          actionClass: actionItem.actionClass,
        },
      });
    }

    historyStore.appendEvent({
      missionControlInterventionPlanId: input.missionControlInterventionPlanId,
      eventType: 'mission_control_orchestration_completed',
      reasonTokens: uniqueSortedStrings(['outcome:completed', ...(input.reasonTokens ?? [])]),
      payload: {
        missionControlInterventionPlanId: input.missionControlInterventionPlanId,
      },
    });

    return projection.projectOne({ missionControlInterventionPlanId: input.missionControlInterventionPlanId });
  }

  function materializeInterventionPlan(input: { missionControlInterventionPlanId: string }) {
    evaluateInterventionPlan(input);
    const materialized = materializer.materializeOne(input);

    historyStore.appendEvent({
      missionControlInterventionPlanId: input.missionControlInterventionPlanId,
      eventType: 'mission_control_materialized',
      reasonTokens: uniqueSortedStrings([
        `materialized:${input.missionControlInterventionPlanId}`,
      ]),
      payload: {
        missionControlInterventionPlanId: input.missionControlInterventionPlanId,
      },
    });

    return materialized;
  }

  return {
    evaluateInterventionPlan,
    deferInterventionPlan,
    markInterventionPlanActive,
    markInterventionPlanComplete,
    materializeInterventionPlan,
  };
}

export type MissionControlOrchestrationManager = ReturnType<typeof createMissionControlOrchestrationManager>;
