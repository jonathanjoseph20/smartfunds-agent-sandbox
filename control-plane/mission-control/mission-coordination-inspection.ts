import {
  createMissionCoordinationProjection,
  type MissionCoordinationProjectionEngine,
} from './mission-coordination-projection.ts';
import {
  createMissionLifecycleHistoryStore,
  type MissionLifecycleHistoryStore,
} from './mission-lifecycle-history-store.ts';
import type {
  MissionCoordinationHistory,
  MissionDependencySummary,
  MissionIntervention,
  MissionLifecycleTransition,
  MissionPriorityLevel,
} from './mission-coordination.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    return [];
  }
  return Array.from(new Set(value.map((entry) => entry.trim()).filter((entry) => entry.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

function parseLifecycleTransitions(history: MissionCoordinationHistory): MissionLifecycleTransition[] {
  return history.entries
    .filter((entry) => entry.eventType === 'mission_lifecycle_transitioned')
    .map((entry) => {
      const transition = entry.payload.transition;
      if (!isRecord(transition)) {
        return null;
      }

      const missionLifecycleTransitionId = asString(transition.missionLifecycleTransitionId);
      const missionRunId = asString(transition.missionRunId);
      const fromState = asString(transition.fromState) as MissionLifecycleTransition['fromState'] | null;
      const toState = asString(transition.toState) as MissionLifecycleTransition['toState'] | null;
      if (!missionLifecycleTransitionId || !missionRunId || !fromState || !toState) {
        return null;
      }

      return {
        missionLifecycleTransitionId,
        missionRunId,
        fromState,
        toState,
        reasonTokens: asStringArray(transition.reasonTokens),
        linkedEscalationIds: asStringArray(transition.linkedEscalationIds),
        linkedInterventionId: asString(transition.linkedInterventionId),
      } satisfies MissionLifecycleTransition;
    })
    .filter((entry): entry is MissionLifecycleTransition => entry !== null);
}

function parseInterventions(history: MissionCoordinationHistory): MissionIntervention[] {
  return history.entries
    .filter((entry) => entry.eventType === 'mission_intervention_recorded')
    .map((entry) => {
      const intervention = entry.payload.intervention;
      if (!isRecord(intervention)) {
        return null;
      }

      const missionInterventionId = asString(intervention.missionInterventionId);
      const missionRunId = asString(intervention.missionRunId);
      const interventionType = asString(intervention.interventionType) as MissionIntervention['interventionType'] | null;
      const requestedBy = asString(intervention.requestedBy);
      const state = asString(intervention.state) as MissionIntervention['state'] | null;
      if (!missionInterventionId || !missionRunId || !interventionType || !requestedBy || !state) {
        return null;
      }

      return {
        missionInterventionId,
        missionRunId,
        interventionType,
        requestedBy,
        reasonTokens: asStringArray(intervention.reasonTokens),
        targetLifecycleState: asString(intervention.targetLifecycleState) as MissionIntervention['targetLifecycleState'],
        linkedEscalationIds: asStringArray(intervention.linkedEscalationIds),
        state,
      } satisfies MissionIntervention;
    })
    .filter((entry): entry is MissionIntervention => entry !== null);
}

function parseDependencies(history: MissionCoordinationHistory): MissionDependencySummary[] {
  const relationships = new Map<string, MissionDependencySummary>();

  for (const entry of history.entries) {
    if (entry.eventType !== 'mission_dependency_linked' && entry.eventType !== 'mission_dependency_unblocked') {
      continue;
    }

    const relationship = entry.payload.relationship;
    if (!isRecord(relationship)) {
      continue;
    }

    const missionRelationshipId = asString(relationship.missionRelationshipId);
    const sourceMissionRunId = asString(relationship.sourceMissionRunId);
    const targetMissionRunId = asString(relationship.targetMissionRunId);
    const relationshipType = asString(relationship.relationshipType) as MissionDependencySummary['relationshipType'] | null;
    const state = asString(relationship.state) as MissionDependencySummary['state'] | null;
    if (!missionRelationshipId || !sourceMissionRunId || !targetMissionRunId || !relationshipType || !state) {
      continue;
    }

    relationships.set(missionRelationshipId, {
      missionRelationshipId,
      sourceMissionRunId,
      targetMissionRunId,
      relationshipType,
      blockingReasonTokens: asStringArray(relationship.blockingReasonTokens),
      state,
    });
  }

  return Array.from(relationships.values()).sort((left, right) => left.missionRelationshipId.localeCompare(right.missionRelationshipId));
}

function parsePriority(history: MissionCoordinationHistory): MissionPriorityLevel {
  let priority: MissionPriorityLevel = 'normal';

  for (const entry of history.entries) {
    if (entry.eventType !== 'mission_priority_updated') {
      continue;
    }

    const signal = entry.payload.prioritySignal;
    if (!isRecord(signal)) {
      continue;
    }

    const value = asString(signal.priority) as MissionPriorityLevel | null;
    if (value) {
      priority = value;
    }
  }

  return priority;
}

export function createMissionCoordinationInspection(options: {
  projection?: MissionCoordinationProjectionEngine;
  historyStore?: MissionLifecycleHistoryStore;
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

  function inspectMissionCoordination(input: { missionRunId: string }) {
    return projection.projectOne(input);
  }

  function inspectMissionLifecycle(input: { missionRunId: string }) {
    const coordination = inspectMissionCoordination(input);
    const history = historyStore.load(input);
    const transitions = parseLifecycleTransitions(history);

    return {
      missionRunId: input.missionRunId,
      lifecycleState: coordination.lifecycleState,
      lastLifecycleTransitionId: coordination.lastLifecycleTransitionId,
      transitions,
    };
  }

  function inspectMissionInterventions(input: { missionRunId: string }) {
    return parseInterventions(historyStore.load(input));
  }

  function inspectMissionPriority(input: { missionRunId: string }) {
    const history = historyStore.load(input);
    return {
      missionRunId: input.missionRunId,
      priority: parsePriority(history),
    };
  }

  function inspectMissionDependencies(input: { missionRunId: string }) {
    return parseDependencies(historyStore.load(input));
  }

  function inspectMissionBlocking(input: { missionRunId: string }) {
    const coordination = inspectMissionCoordination(input);

    return {
      missionRunId: input.missionRunId,
      coordinationState: coordination.coordinationState,
      blockingMissionRunIds: coordination.blockingMissionRunIds,
      blockedByEscalations: coordination.blockedByEscalations,
      resumeEligibility: coordination.resumeEligibility,
    };
  }

  function inspectMissionCoordinationHistory(input: { missionRunId: string }) {
    return historyStore.load(input);
  }

  return {
    inspectMissionCoordination,
    inspectMissionLifecycle,
    inspectMissionInterventions,
    inspectMissionPriority,
    inspectMissionDependencies,
    inspectMissionBlocking,
    inspectMissionCoordinationHistory,
  };
}

export type MissionCoordinationInspection = ReturnType<typeof createMissionCoordinationInspection>;
