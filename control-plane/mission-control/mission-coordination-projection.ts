import {
  createMissionRunProjection,
  type MissionRunProjectionEngine,
} from './mission-run-projection.ts';
import type { MissionRunProjection } from './mission-run-types.ts';

import {
  type MissionCoordinationProjection,
  type MissionDependencySummary,
  type MissionIntervention,
  type MissionLifecycleState,
  type MissionLifecycleTransition,
  type MissionPriorityLevel,
  type MissionRelationship,
} from './mission-coordination.ts';
import {
  createMissionLifecycleHistoryStore,
  resolveMissionCoordinationArtifactPaths,
  type MissionLifecycleHistoryStore,
} from './mission-lifecycle-history-store.ts';

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

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function inferLifecycleStateFromMissionRun(runProjection: MissionRunProjection): MissionLifecycleState {
  if (runProjection.operationalState === 'completed') {
    return 'completed';
  }

  if (runProjection.operationalState === 'failed') {
    return 'failed';
  }

  if (runProjection.operationalState === 'cancelled') {
    return 'cancelled';
  }

  if (runProjection.operationalState === 'blocked') {
    return 'blocked';
  }

  if (runProjection.operationalState === 'active' || runProjection.operationalState === 'retrying' || runProjection.operationalState === 'degraded') {
    return 'active';
  }

  if (runProjection.operationalState === 'pending') {
    return 'ready';
  }

  return 'created';
}

function parseIntervention(payload: Record<string, unknown>): MissionIntervention | null {
  const intervention = payload.intervention;
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

  const targetLifecycleStateRaw = asString(intervention.targetLifecycleState);

  return {
    missionInterventionId,
    missionRunId,
    interventionType,
    requestedBy,
    reasonTokens: asStringArray(intervention.reasonTokens),
    targetLifecycleState: targetLifecycleStateRaw as MissionLifecycleState | null,
    linkedEscalationIds: asStringArray(intervention.linkedEscalationIds),
    state,
  };
}

function parseLifecycleTransition(payload: Record<string, unknown>): MissionLifecycleTransition | null {
  const transition = payload.transition;
  if (!isRecord(transition)) {
    return null;
  }

  const missionLifecycleTransitionId = asString(transition.missionLifecycleTransitionId);
  const missionRunId = asString(transition.missionRunId);
  const fromState = asString(transition.fromState) as MissionLifecycleState | null;
  const toState = asString(transition.toState) as MissionLifecycleState | null;

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
  };
}

function parseRelationship(payload: Record<string, unknown>): MissionRelationship | null {
  const relationship = payload.relationship;
  if (!isRecord(relationship)) {
    return null;
  }

  const missionRelationshipId = asString(relationship.missionRelationshipId);
  const sourceMissionRunId = asString(relationship.sourceMissionRunId);
  const targetMissionRunId = asString(relationship.targetMissionRunId);
  const relationshipType = asString(relationship.relationshipType) as MissionRelationship['relationshipType'] | null;
  const state = asString(relationship.state) as MissionRelationship['state'] | null;

  if (!missionRelationshipId || !sourceMissionRunId || !targetMissionRunId || !relationshipType || !state) {
    return null;
  }

  return {
    missionRelationshipId,
    sourceMissionRunId,
    targetMissionRunId,
    relationshipType,
    blockingReasonTokens: asStringArray(relationship.blockingReasonTokens),
    state,
  };
}

function parsePriority(payload: Record<string, unknown>): MissionPriorityLevel | null {
  const signal = payload.prioritySignal;
  if (!isRecord(signal)) {
    return null;
  }

  const priority = asString(signal.priority);
  if (!priority) {
    return null;
  }

  return priority as MissionPriorityLevel;
}

function deriveBlockingMissionRunIds(input: {
  missionRunId: string;
  dependencies: MissionDependencySummary[];
}): string[] {
  const blockers: string[] = [];

  for (const relationship of input.dependencies) {
    if (relationship.state !== 'active') {
      continue;
    }

    if (relationship.relationshipType === 'depends_on' && relationship.sourceMissionRunId === input.missionRunId) {
      blockers.push(relationship.targetMissionRunId);
      continue;
    }

    if (relationship.relationshipType === 'requires_review_from' && relationship.sourceMissionRunId === input.missionRunId) {
      blockers.push(relationship.targetMissionRunId);
      continue;
    }

    if (relationship.relationshipType === 'blocks' && relationship.targetMissionRunId === input.missionRunId) {
      blockers.push(relationship.sourceMissionRunId);
    }
  }

  return uniqueSorted(blockers);
}

function deriveCoordinationState(input: {
  lifecycleState: MissionLifecycleState;
  blockingMissionRunIds: string[];
  blockedByEscalations: string[];
  resumeEligibility: 'eligible' | 'ineligible';
}): MissionCoordinationProjection['coordinationState'] {
  if (input.lifecycleState === 'completed') {
    return 'completed';
  }

  if (input.lifecycleState === 'failed') {
    return 'failed';
  }

  if (input.lifecycleState === 'cancelled') {
    return 'cancelled_by_operator';
  }

  if (input.lifecycleState === 'paused') {
    return 'paused_by_operator';
  }

  if (input.lifecycleState === 'resuming' && input.resumeEligibility === 'eligible') {
    return 'ready_to_resume';
  }

  if (input.blockingMissionRunIds.length > 0) {
    return 'blocked_by_dependency';
  }

  if (input.blockedByEscalations.length > 0) {
    return 'blocked_by_escalation';
  }

  if (input.lifecycleState === 'ready' || input.lifecycleState === 'created') {
    return 'awaiting_start';
  }

  if (input.lifecycleState === 'active' || input.lifecycleState === 'resuming') {
    return 'active';
  }

  return 'inconclusive';
}

export function createMissionCoordinationProjection(options: {
  missionRunProjection?: MissionRunProjectionEngine;
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
  const missionRunProjection = options.missionRunProjection ?? createMissionRunProjection({
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

  const historyStore = options.historyStore ?? createMissionLifecycleHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function projectOne(input: { missionRunId: string }): MissionCoordinationProjection {
    const runProjection = missionRunProjection.projectOne({ missionRunId: input.missionRunId });
    const history = historyStore.load({ missionRunId: input.missionRunId });

    const transitions = history.entries
      .filter((entry) => entry.eventType === 'mission_lifecycle_transitioned')
      .map((entry) => parseLifecycleTransition(entry.payload))
      .filter((entry): entry is MissionLifecycleTransition => entry !== null);

    const interventions = Array.from(new Map(history.entries
      .filter((entry) => entry.eventType === 'mission_intervention_recorded')
      .map((entry) => parseIntervention(entry.payload))
      .filter((entry): entry is MissionIntervention => entry !== null)
      .map((entry) => [entry.missionInterventionId, entry] as const)).values());

    const relationshipMap = new Map<string, MissionRelationship>();
    for (const entry of history.entries) {
      if (entry.eventType !== 'mission_dependency_linked' && entry.eventType !== 'mission_dependency_unblocked') {
        continue;
      }
      const relationship = parseRelationship(entry.payload);
      if (relationship) {
        relationshipMap.set(relationship.missionRelationshipId, relationship);
      }
    }

    const dependencySummaries: MissionDependencySummary[] = Array.from(relationshipMap.values())
      .map((relationship) => ({
        missionRelationshipId: relationship.missionRelationshipId,
        sourceMissionRunId: relationship.sourceMissionRunId,
        targetMissionRunId: relationship.targetMissionRunId,
        relationshipType: relationship.relationshipType,
        blockingReasonTokens: relationship.blockingReasonTokens,
        state: relationship.state,
      }))
      .sort((left, right) => left.missionRelationshipId.localeCompare(right.missionRelationshipId));

    const lifecycleState = transitions.at(-1)?.toState ?? inferLifecycleStateFromMissionRun(runProjection);

    let priority: MissionPriorityLevel = 'normal';
    for (const entry of history.entries) {
      if (entry.eventType !== 'mission_priority_updated') {
        continue;
      }
      const parsedPriority = parsePriority(entry.payload);
      if (parsedPriority) {
        priority = parsedPriority;
      }
    }

    const blockedByEscalations = runProjection.escalations
      .filter((escalation) => escalation.state === 'open' || escalation.state === 'acknowledged')
      .map((escalation) => escalation.escalationId)
      .sort((left, right) => left.localeCompare(right));

    const blockingMissionRunIds = deriveBlockingMissionRunIds({
      missionRunId: input.missionRunId,
      dependencies: dependencySummaries,
    });

    const activeInterventions = interventions
      .filter((entry) => entry.state === 'recorded');

    const resumeEligibility = (lifecycleState === 'paused' || lifecycleState === 'resuming')
      && blockingMissionRunIds.length === 0
      && blockedByEscalations.length === 0
      ? 'eligible'
      : 'ineligible';

    const coordinationState = deriveCoordinationState({
      lifecycleState,
      blockingMissionRunIds,
      blockedByEscalations,
      resumeEligibility,
    });

    const artifactPaths = resolveMissionCoordinationArtifactPaths({
      missionRunId: input.missionRunId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const statusPreview = {
      missionRunId: input.missionRunId,
      lifecycleState,
      coordinationState,
      priority,
      blockingMissionRunIds,
      blockedByEscalations,
      resumeEligibility,
      lastLifecycleTransitionId: transitions.at(-1)?.missionLifecycleTransitionId ?? null,
      lastInterventionId: activeInterventions.at(-1)?.missionInterventionId ?? null,
    } as Record<string, unknown>;

    const reportPreview = {
      missionRun: {
        missionRunId: runProjection.missionRunId,
        missionId: runProjection.missionId,
        operationalState: runProjection.operationalState,
        completionState: runProjection.completionState,
        healthState: runProjection.healthState,
      },
      coordination: statusPreview,
      interventions: activeInterventions,
      dependencies: dependencySummaries,
      artifacts: artifactPaths,
    } as Record<string, unknown>;

    return {
      missionRunId: input.missionRunId,
      lifecycleState,
      coordinationState,
      priority,
      activeInterventions,
      dependencySummaries,
      blockingMissionRunIds,
      blockedByEscalations,
      resumeEligibility,
      lastLifecycleTransitionId: transitions.at(-1)?.missionLifecycleTransitionId ?? null,
      lastInterventionId: activeInterventions.at(-1)?.missionInterventionId ?? null,
      statusPreview,
      reportPreview,
    };
  }

  return {
    projectOne,
  };
}

export type MissionCoordinationProjectionEngine = ReturnType<typeof createMissionCoordinationProjection>;
