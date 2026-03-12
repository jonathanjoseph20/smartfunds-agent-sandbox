import {
  createMissionLifecycleTransition,
  type MissionLifecycleTransition,
} from './mission-lifecycle.ts';
import { createMissionIntervention } from './mission-intervention.ts';
import {
  createMissionRelationship,
  unblockMissionRelationship,
} from './mission-dependency.ts';
import {
  createMissionPrioritySignal,
  deriveMissionPriorityUpdateId,
} from './mission-priority.ts';
import {
  createMissionLifecycleHistoryStore,
  type MissionLifecycleHistoryStore,
} from './mission-lifecycle-history-store.ts';
import {
  createMissionCoordinationProjection,
  type MissionCoordinationProjectionEngine,
} from './mission-coordination-projection.ts';
import type {
  InvalidLifecycleTransitionErrorPayload,
  MissionInterventionType,
  MissionLifecycleState,
  MissionPriorityLevel,
  MissionRelationshipType,
} from './mission-coordination.ts';

function transitionWithHistory(input: {
  historyStore: MissionLifecycleHistoryStore;
  projection: MissionCoordinationProjectionEngine;
  missionRunId: string;
  toState: MissionLifecycleState;
  reasonTokens?: string[];
  linkedEscalationIds?: string[];
  linkedInterventionId?: string | null;
}): {
  transition: MissionLifecycleTransition;
} | InvalidLifecycleTransitionErrorPayload {
  const projected = input.projection.projectOne({ missionRunId: input.missionRunId });
  const transition = createMissionLifecycleTransition({
    missionRunId: input.missionRunId,
    fromState: projected.lifecycleState,
    toState: input.toState,
    reasonTokens: input.reasonTokens,
    linkedEscalationIds: input.linkedEscalationIds,
    linkedInterventionId: input.linkedInterventionId,
  });

  if ('error' in transition) {
    return transition;
  }

  input.historyStore.append({
    missionRunId: input.missionRunId,
    eventType: 'mission_lifecycle_transitioned',
    reasonTokens: transition.reasonTokens,
    payload: {
      transition,
    },
  });

  if (transition.toState === 'paused') {
    input.historyStore.append({
      missionRunId: input.missionRunId,
      eventType: 'mission_paused',
      reasonTokens: transition.reasonTokens,
      payload: {
        transition,
      },
    });
  }

  if (transition.toState === 'cancelled') {
    input.historyStore.append({
      missionRunId: input.missionRunId,
      eventType: 'mission_cancelled',
      reasonTokens: transition.reasonTokens,
      payload: {
        transition,
      },
    });
  }

  if (transition.fromState === 'resuming' && transition.toState === 'active') {
    input.historyStore.append({
      missionRunId: input.missionRunId,
      eventType: 'mission_resumed',
      reasonTokens: transition.reasonTokens,
      payload: {
        transition,
      },
    });
  }

  return { transition };
}

export function createMissionCoordination(options: {
  historyStore?: MissionLifecycleHistoryStore;
  projection?: MissionCoordinationProjectionEngine;
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
  const historyStore = options.historyStore ?? createMissionLifecycleHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  const projection = options.projection ?? createMissionCoordinationProjection({
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

  function recordIntervention(input: {
    missionRunId: string;
    interventionType: MissionInterventionType;
    requestedBy: string;
    reasonTokens?: string[];
    targetLifecycleState?: MissionLifecycleState | null;
    linkedEscalationIds?: string[];
  }) {
    const intervention = createMissionIntervention({
      missionRunId: input.missionRunId,
      interventionType: input.interventionType,
      requestedBy: input.requestedBy,
      reasonTokens: input.reasonTokens,
      targetLifecycleState: input.targetLifecycleState,
      linkedEscalationIds: input.linkedEscalationIds,
      state: 'recorded',
    });

    historyStore.append({
      missionRunId: input.missionRunId,
      eventType: 'mission_intervention_recorded',
      reasonTokens: intervention.reasonTokens,
      payload: {
        intervention,
      },
    });

    return intervention;
  }

  function updatePriority(input: {
    missionRunId: string;
    priority: MissionPriorityLevel;
    reasonTokens?: string[];
  }) {
    const prioritySignal = createMissionPrioritySignal(input);
    const priorityUpdateId = deriveMissionPriorityUpdateId(input);

    historyStore.append({
      missionRunId: input.missionRunId,
      eventType: 'mission_priority_updated',
      reasonTokens: prioritySignal.reasonTokens,
      payload: {
        priorityUpdateId,
        prioritySignal,
      },
    });

    return {
      missionRunId: input.missionRunId,
      priority: input.priority,
      priorityUpdateId,
      reasonTokens: prioritySignal.reasonTokens,
    };
  }

  function linkDependency(input: {
    missionRunId: string;
    sourceMissionRunId: string;
    targetMissionRunId: string;
    relationshipType: MissionRelationshipType;
    blockingReasonTokens?: string[];
  }) {
    const relationship = createMissionRelationship({
      sourceMissionRunId: input.sourceMissionRunId,
      targetMissionRunId: input.targetMissionRunId,
      relationshipType: input.relationshipType,
      blockingReasonTokens: input.blockingReasonTokens,
      state: 'active',
    });

    historyStore.append({
      missionRunId: input.missionRunId,
      eventType: 'mission_dependency_linked',
      reasonTokens: relationship.blockingReasonTokens,
      payload: {
        relationship,
      },
    });

    historyStore.append({
      missionRunId: input.missionRunId,
      eventType: 'mission_coordination_blocked',
      reasonTokens: relationship.blockingReasonTokens,
      payload: {
        relationship,
      },
    });

    return relationship;
  }

  function unblockDependency(input: {
    missionRunId: string;
    sourceMissionRunId: string;
    targetMissionRunId: string;
    relationshipType: MissionRelationshipType;
    blockingReasonTokens?: string[];
  }) {
    const relationship = unblockMissionRelationship(createMissionRelationship({
      sourceMissionRunId: input.sourceMissionRunId,
      targetMissionRunId: input.targetMissionRunId,
      relationshipType: input.relationshipType,
      blockingReasonTokens: input.blockingReasonTokens,
      state: 'active',
    }));

    historyStore.append({
      missionRunId: input.missionRunId,
      eventType: 'mission_dependency_unblocked',
      reasonTokens: relationship.blockingReasonTokens,
      payload: {
        relationship,
      },
    });

    historyStore.append({
      missionRunId: input.missionRunId,
      eventType: 'mission_coordination_unblocked',
      reasonTokens: relationship.blockingReasonTokens,
      payload: {
        relationship,
      },
    });

    return relationship;
  }

  function pauseMission(input: {
    missionRunId: string;
    requestedBy: string;
    reasonTokens?: string[];
    linkedEscalationIds?: string[];
  }) {
    const intervention = recordIntervention({
      missionRunId: input.missionRunId,
      interventionType: 'pause',
      requestedBy: input.requestedBy,
      reasonTokens: input.reasonTokens,
      linkedEscalationIds: input.linkedEscalationIds,
      targetLifecycleState: 'paused',
    });

    const transitionResult = transitionWithHistory({
      historyStore,
      projection,
      missionRunId: input.missionRunId,
      toState: 'paused',
      reasonTokens: input.reasonTokens,
      linkedEscalationIds: input.linkedEscalationIds,
      linkedInterventionId: intervention.missionInterventionId,
    });

    if ('error' in transitionResult) {
      return transitionResult;
    }

    return {
      missionRunId: input.missionRunId,
      interventionId: intervention.missionInterventionId,
      transitionId: transitionResult.transition.missionLifecycleTransitionId,
      lifecycleState: transitionResult.transition.toState,
    };
  }

  function resumeMission(input: {
    missionRunId: string;
    requestedBy: string;
    reasonTokens?: string[];
    linkedEscalationIds?: string[];
  }) {
    const intervention = recordIntervention({
      missionRunId: input.missionRunId,
      interventionType: 'resume',
      requestedBy: input.requestedBy,
      reasonTokens: input.reasonTokens,
      linkedEscalationIds: input.linkedEscalationIds,
      targetLifecycleState: 'active',
    });

    const firstTransition = transitionWithHistory({
      historyStore,
      projection,
      missionRunId: input.missionRunId,
      toState: 'resuming',
      reasonTokens: input.reasonTokens,
      linkedEscalationIds: input.linkedEscalationIds,
      linkedInterventionId: intervention.missionInterventionId,
    });

    if ('error' in firstTransition) {
      return firstTransition;
    }

    const secondTransition = transitionWithHistory({
      historyStore,
      projection,
      missionRunId: input.missionRunId,
      toState: 'active',
      reasonTokens: input.reasonTokens,
      linkedEscalationIds: input.linkedEscalationIds,
      linkedInterventionId: intervention.missionInterventionId,
    });

    if ('error' in secondTransition) {
      return secondTransition;
    }

    return {
      missionRunId: input.missionRunId,
      interventionId: intervention.missionInterventionId,
      transitionIds: [firstTransition.transition.missionLifecycleTransitionId, secondTransition.transition.missionLifecycleTransitionId],
      lifecycleState: secondTransition.transition.toState,
    };
  }

  function cancelMission(input: {
    missionRunId: string;
    requestedBy: string;
    reasonTokens?: string[];
    linkedEscalationIds?: string[];
  }) {
    const intervention = recordIntervention({
      missionRunId: input.missionRunId,
      interventionType: 'cancel',
      requestedBy: input.requestedBy,
      reasonTokens: input.reasonTokens,
      linkedEscalationIds: input.linkedEscalationIds,
      targetLifecycleState: 'cancelled',
    });

    const transitionResult = transitionWithHistory({
      historyStore,
      projection,
      missionRunId: input.missionRunId,
      toState: 'cancelled',
      reasonTokens: input.reasonTokens,
      linkedEscalationIds: input.linkedEscalationIds,
      linkedInterventionId: intervention.missionInterventionId,
    });

    if ('error' in transitionResult) {
      return transitionResult;
    }

    return {
      missionRunId: input.missionRunId,
      interventionId: intervention.missionInterventionId,
      transitionId: transitionResult.transition.missionLifecycleTransitionId,
      lifecycleState: transitionResult.transition.toState,
    };
  }

  function reprioritizeMission(input: {
    missionRunId: string;
    requestedBy: string;
    priority: MissionPriorityLevel;
    reasonTokens?: string[];
  }) {
    const intervention = recordIntervention({
      missionRunId: input.missionRunId,
      interventionType: 'reprioritize',
      requestedBy: input.requestedBy,
      reasonTokens: input.reasonTokens,
      targetLifecycleState: null,
    });

    const priority = updatePriority({
      missionRunId: input.missionRunId,
      priority: input.priority,
      reasonTokens: input.reasonTokens,
    });

    return {
      missionRunId: input.missionRunId,
      interventionId: intervention.missionInterventionId,
      priority,
    };
  }

  return {
    pauseMission,
    resumeMission,
    cancelMission,
    reprioritizeMission,
    recordIntervention,
    updatePriority,
    linkDependency,
    unblockDependency,
  };
}

export type MissionCoordination = ReturnType<typeof createMissionCoordination>;
