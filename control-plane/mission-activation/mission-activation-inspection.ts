import {
  createMissionActivationEvaluator,
  type MissionActivationEvaluator,
} from './mission-activation-evaluator.ts';
import {
  createMissionActivationHistoryStore,
  type MissionActivationHistoryStore,
} from './mission-activation-history-store.ts';
import {
  createMissionActivationMaterializer,
  type MissionActivationMaterializer,
} from './mission-activation-materializer.ts';
import {
  createMissionActivationProjection,
  type MissionActivationProjectionEngine,
} from './mission-activation-projection.ts';

function appendEvaluationEvents(input: {
  historyStore: MissionActivationHistoryStore;
  activationDecisionId: string;
  missionId: string;
  activationState: string;
  executionReadinessState: string;
  activationPolicyId: string;
}): void {
  input.historyStore.append({
    activationDecisionId: input.activationDecisionId,
    missionId: input.missionId,
    eventType: 'activation_evaluated',
    reasoning: 'mission_activation_evaluated',
    payload: {
      missionId: input.missionId,
      activationDecisionId: input.activationDecisionId,
      activationPolicyId: input.activationPolicyId,
      activationState: input.activationState,
      executionReadinessState: input.executionReadinessState,
    },
  });

  if (input.activationState === 'ready_for_activation') {
    input.historyStore.append({
      activationDecisionId: input.activationDecisionId,
      missionId: input.missionId,
      eventType: 'activation_ready',
      reasoning: 'mission_activation_ready_for_handoff',
      payload: {
        missionId: input.missionId,
        activationDecisionId: input.activationDecisionId,
      },
    });
  }

  if (input.activationState === 'blocked') {
    input.historyStore.append({
      activationDecisionId: input.activationDecisionId,
      missionId: input.missionId,
      eventType: 'activation_blocked',
      reasoning: 'mission_activation_blocked_by_preconditions',
      payload: {
        missionId: input.missionId,
        activationDecisionId: input.activationDecisionId,
      },
    });
  }
}

export function createMissionActivationInspection(options: {
  evaluator?: MissionActivationEvaluator;
  projection?: MissionActivationProjectionEngine;
  historyStore?: MissionActivationHistoryStore;
  materializer?: MissionActivationMaterializer;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
  dagDefinitionsDir?: string;
  missionDAGArtifactsRoot?: string;
  activationArtifactsRoot?: string;
} = {}) {
  const evaluator = options.evaluator ?? createMissionActivationEvaluator({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    dagDefinitionsDir: options.dagDefinitionsDir,
    missionDAGArtifactsRoot: options.missionDAGArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createMissionActivationHistoryStore({
    artifactsRoot: options.activationArtifactsRoot,
  });

  const projection = options.projection ?? createMissionActivationProjection({
    evaluator,
    historyStore,
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    dagDefinitionsDir: options.dagDefinitionsDir,
    missionDAGArtifactsRoot: options.missionDAGArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
  });

  const materializer = options.materializer ?? createMissionActivationMaterializer({
    projection,
    historyStore,
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    dagDefinitionsDir: options.dagDefinitionsDir,
    missionDAGArtifactsRoot: options.missionDAGArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
  });

  function evaluateActivation(input: {
    missionId: string;
    activationPolicyId?: string;
  }) {
    const evaluated = projection.projectOne(input);

    appendEvaluationEvents({
      historyStore,
      activationDecisionId: evaluated.activationDecisionId,
      missionId: evaluated.missionId,
      activationState: evaluated.activationState,
      executionReadinessState: evaluated.executionReadinessState,
      activationPolicyId: evaluated.activationPolicyId,
    });

    return projection.projectOne(input);
  }

  function inspectActivationDecision(input: {
    missionId: string;
    activationPolicyId?: string;
  }) {
    return projection.projectOne(input);
  }

  function listActivationDecisions(input: { activationPolicyId?: string } = {}) {
    return projection.summarizeList(input);
  }

  function getActivationBlockers(input: {
    missionId: string;
    activationPolicyId?: string;
  }): string[] {
    return projection.projectOne(input).blockingReasons;
  }

  function getExecutionReadiness(input: {
    missionId: string;
    activationPolicyId?: string;
  }) {
    const projected = projection.projectOne(input);
    return {
      activationDecisionId: projected.activationDecisionId,
      missionId: projected.missionId,
      executionReadinessState: projected.executionReadinessState,
      activationState: projected.activationState,
      blockingReasons: projected.blockingReasons,
      limitations: projected.limitations,
    };
  }

  function getHandoffContract(input: {
    missionId: string;
    activationPolicyId?: string;
  }) {
    return projection.projectOne(input).handoffContract;
  }

  function getActivationStatus(input: {
    missionId: string;
    activationPolicyId?: string;
  }) {
    return projection.projectOne(input).statusPreview;
  }

  function getActivationHistory(input: {
    missionId: string;
    activationPolicyId?: string;
  }) {
    const projected = projection.projectOne(input);
    return historyStore.load({
      activationDecisionId: projected.activationDecisionId,
      missionId: projected.missionId,
    });
  }

  function confirmActivation(input: {
    missionId: string;
    activationPolicyId?: string;
    reviewedBy?: string;
  }) {
    const projected = evaluateActivation({
      missionId: input.missionId,
      activationPolicyId: input.activationPolicyId,
    });

    historyStore.append({
      activationDecisionId: projected.activationDecisionId,
      missionId: projected.missionId,
      eventType: 'activation_confirmed',
      reasoning: 'activation_confirmed_by_founder',
      payload: {
        missionId: projected.missionId,
        activationDecisionId: projected.activationDecisionId,
        reviewedBy: input.reviewedBy ?? null,
      },
    });

    return projection.projectOne({
      missionId: input.missionId,
      activationPolicyId: projected.activationPolicyId,
    });
  }

  function rejectActivation(input: {
    missionId: string;
    reason: string;
    reviewedBy?: string;
    activationPolicyId?: string;
  }) {
    const projected = evaluateActivation({
      missionId: input.missionId,
      activationPolicyId: input.activationPolicyId,
    });

    historyStore.append({
      activationDecisionId: projected.activationDecisionId,
      missionId: projected.missionId,
      eventType: 'activation_rejected',
      reasoning: 'activation_rejected_by_founder',
      payload: {
        missionId: projected.missionId,
        activationDecisionId: projected.activationDecisionId,
        reason: input.reason,
        reviewedBy: input.reviewedBy ?? null,
      },
    });

    return projection.projectOne({
      missionId: input.missionId,
      activationPolicyId: projected.activationPolicyId,
    });
  }

  function materializeActivation(input: {
    missionId: string;
    activationPolicyId?: string;
  }) {
    evaluateActivation(input);
    return materializer.materializeOne(input);
  }

  return {
    evaluateActivation,
    inspectActivationDecision,
    listActivationDecisions,
    getActivationBlockers,
    getExecutionReadiness,
    getHandoffContract,
    getActivationStatus,
    getActivationHistory,
    confirmActivation,
    rejectActivation,
    materializeActivation,
  };
}

export type MissionActivationInspection = ReturnType<typeof createMissionActivationInspection>;
