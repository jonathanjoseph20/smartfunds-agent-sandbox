import {
  createMissionAssignmentEvaluator,
  type MissionAssignmentEvaluator,
} from './mission-assignment-evaluator.ts';
import {
  createMissionAssignmentHistoryStore,
  type MissionAssignmentHistoryStore,
} from './mission-assignment-history-store.ts';
import {
  createMissionAssignmentMaterializer,
  type MissionAssignmentMaterializer,
} from './mission-assignment-materializer.ts';
import {
  createMissionAssignmentProjection,
  type MissionAssignmentProjectionEngine,
} from './mission-assignment-projection.ts';
import type { MissionAssignmentFounderOverride } from './mission-assignment-types.ts';

function appendEvaluationEvents(input: {
  historyStore: MissionAssignmentHistoryStore;
  assignmentDecisionId: string;
  missionId: string;
  decisionState: string;
  selectedTeamId?: string;
  assignmentPolicyId: string;
}): void {
  input.historyStore.append({
    assignmentDecisionId: input.assignmentDecisionId,
    missionId: input.missionId,
    eventType: 'assignment_evaluated',
    reasoning: 'mission_assignment_evaluated',
    payload: {
      missionId: input.missionId,
      assignmentDecisionId: input.assignmentDecisionId,
      assignmentPolicyId: input.assignmentPolicyId,
      decisionState: input.decisionState,
      selectedTeamId: input.selectedTeamId ?? null,
    },
  });

  if (input.decisionState === 'recommended' || input.decisionState === 'under_review') {
    input.historyStore.append({
      assignmentDecisionId: input.assignmentDecisionId,
      missionId: input.missionId,
      eventType: 'assignment_recommended',
      reasoning: 'assignment_recommendation_emitted',
      payload: {
        missionId: input.missionId,
        assignmentDecisionId: input.assignmentDecisionId,
        selectedTeamId: input.selectedTeamId ?? null,
      },
    });
  }
}

function appendMissionResolution(input: {
  historyStore: MissionAssignmentHistoryStore;
  missionId: string;
  assignmentDecisionId: string;
  assignmentPolicyId: string;
  selectedTeamId?: string;
  founderOverride: MissionAssignmentFounderOverride;
  resolutionType: 'evaluated' | 'confirmed' | 'overridden' | 'materialized';
  reasoning: string;
}): void {
  input.historyStore.appendMissionResolution({
    missionId: input.missionId,
    assignmentDecisionId: input.assignmentDecisionId,
    assignmentPolicyId: input.assignmentPolicyId,
    selectedTeamId: input.selectedTeamId,
    founderOverride: input.founderOverride,
    resolutionType: input.resolutionType,
    reasoning: input.reasoning,
  });
}

export function createMissionAssignmentInspection(options: {
  evaluator?: MissionAssignmentEvaluator;
  projection?: MissionAssignmentProjectionEngine;
  historyStore?: MissionAssignmentHistoryStore;
  materializer?: MissionAssignmentMaterializer;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
} = {}) {
  const evaluator = options.evaluator ?? createMissionAssignmentEvaluator({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createMissionAssignmentHistoryStore({
    artifactsRoot: options.assignmentArtifactsRoot,
  });

  const projection = options.projection ?? createMissionAssignmentProjection({
    evaluator,
    historyStore,
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
  });

  const materializer = options.materializer ?? createMissionAssignmentMaterializer({
    projection,
    historyStore,
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
  });

  function evaluateAssignment(input: {
    missionId: string;
    assignmentPolicyId?: string;
    founderOverride?: MissionAssignmentFounderOverride;
  }) {
    const evaluation = evaluator.evaluateMissionAssignment(input);
    appendEvaluationEvents({
      historyStore,
      assignmentDecisionId: evaluation.assignmentDecision.assignmentDecisionId,
      missionId: evaluation.assignmentDecision.missionId,
      decisionState: evaluation.assignmentDecision.decisionState,
      selectedTeamId: evaluation.assignmentDecision.selectedTeamId,
      assignmentPolicyId: evaluation.assignmentDecision.assignmentPolicyId,
    });
    appendMissionResolution({
      historyStore,
      missionId: evaluation.assignmentDecision.missionId,
      assignmentDecisionId: evaluation.assignmentDecision.assignmentDecisionId,
      assignmentPolicyId: evaluation.assignmentDecision.assignmentPolicyId,
      selectedTeamId: evaluation.assignmentDecision.selectedTeamId,
      founderOverride: evaluation.assignmentDecision.founderOverride,
      resolutionType: 'evaluated',
      reasoning: 'mission_assignment_resolution_evaluated',
    });

    return projection.projectOne(input);
  }

  function inspectAssignment(input: {
    missionId: string;
    assignmentPolicyId?: string;
    founderOverride?: MissionAssignmentFounderOverride;
  }) {
    return projection.projectOne(input);
  }

  function listAssignments(input: { assignmentPolicyId?: string } = {}) {
    return projection.summarizeList(input);
  }

  function getSelectedTeam(input: {
    missionId: string;
    assignmentPolicyId?: string;
    founderOverride?: MissionAssignmentFounderOverride;
  }): string | undefined {
    return projection.projectOne(input).selectedTeamId;
  }

  function getAlternativeTeams(input: {
    missionId: string;
    assignmentPolicyId?: string;
    founderOverride?: MissionAssignmentFounderOverride;
  }): string[] {
    return projection.projectOne(input).alternativeTeams;
  }

  function getAssignmentStatus(input: {
    missionId: string;
    assignmentPolicyId?: string;
    founderOverride?: MissionAssignmentFounderOverride;
  }) {
    return projection.projectOne(input).statusPreview;
  }

  function getAssignmentHistory(input: {
    missionId: string;
    assignmentPolicyId?: string;
    founderOverride?: MissionAssignmentFounderOverride;
  }) {
    const projected = projection.projectOne(input);
    return historyStore.load({
      assignmentDecisionId: projected.assignmentDecisionId,
      missionId: projected.missionId,
    });
  }

  function confirmAssignment(input: {
    missionId: string;
    assignmentPolicyId?: string;
  }) {
    const projected = evaluateAssignment({
      missionId: input.missionId,
      assignmentPolicyId: input.assignmentPolicyId,
    });

    if (!projected.selectedTeamId) {
      throw new Error(`MISSION_ASSIGNMENT_NO_SELECTION: ${input.missionId}`);
    }

    historyStore.append({
      assignmentDecisionId: projected.assignmentDecisionId,
      missionId: projected.missionId,
      eventType: 'assignment_confirmed',
      reasoning: 'assignment_confirmed_by_founder',
      payload: {
        missionId: projected.missionId,
        assignmentDecisionId: projected.assignmentDecisionId,
        selectedTeamId: projected.selectedTeamId,
      },
    });

    appendMissionResolution({
      historyStore,
      missionId: projected.missionId,
      assignmentDecisionId: projected.assignmentDecisionId,
      assignmentPolicyId: projected.assignmentPolicyId,
      selectedTeamId: projected.selectedTeamId,
      founderOverride: projected.founderOverride,
      resolutionType: 'confirmed',
      reasoning: 'mission_assignment_resolution_confirmed',
    });

    return projection.projectOne({
      missionId: input.missionId,
      assignmentPolicyId: projected.assignmentPolicyId,
    });
  }

  function overrideAssignment(input: {
    missionId: string;
    selectedTeamId: string;
    reason: string;
    reviewedBy?: string;
    assignmentPolicyId?: string;
  }) {
    const projected = evaluateAssignment({
      missionId: input.missionId,
      assignmentPolicyId: input.assignmentPolicyId,
      founderOverride: {
        applied: true,
        selectedTeamId: input.selectedTeamId,
        reason: input.reason,
        ...(input.reviewedBy ? { reviewedBy: input.reviewedBy } : {}),
      },
    });

    historyStore.append({
      assignmentDecisionId: projected.assignmentDecisionId,
      missionId: projected.missionId,
      eventType: 'assignment_overridden',
      reasoning: 'assignment_overridden_by_founder',
      payload: {
        missionId: projected.missionId,
        assignmentDecisionId: projected.assignmentDecisionId,
        selectedTeamId: input.selectedTeamId,
        reason: input.reason,
        reviewedBy: input.reviewedBy ?? null,
      },
    });

    appendMissionResolution({
      historyStore,
      missionId: projected.missionId,
      assignmentDecisionId: projected.assignmentDecisionId,
      assignmentPolicyId: projected.assignmentPolicyId,
      selectedTeamId: projected.selectedTeamId,
      founderOverride: projected.founderOverride,
      resolutionType: 'overridden',
      reasoning: 'mission_assignment_resolution_overridden',
    });

    return projection.projectOne({
      missionId: input.missionId,
      assignmentPolicyId: projected.assignmentPolicyId,
      founderOverride: {
        applied: true,
        selectedTeamId: input.selectedTeamId,
        reason: input.reason,
        ...(input.reviewedBy ? { reviewedBy: input.reviewedBy } : {}),
      },
    });
  }

  function materializeAssignment(input: {
    missionId: string;
    assignmentPolicyId?: string;
  }) {
    const currentResolution = historyStore.getCurrentMissionResolution(input.missionId);
    if (!currentResolution || input.assignmentPolicyId) {
      evaluateAssignment({
        missionId: input.missionId,
        assignmentPolicyId: input.assignmentPolicyId,
      });
    }

    const materialized = materializer.materializeOne({
      missionId: input.missionId,
      assignmentPolicyId: input.assignmentPolicyId,
    });

    const projected = projection.projectOne({
      missionId: input.missionId,
      assignmentPolicyId: input.assignmentPolicyId,
    });

    appendMissionResolution({
      historyStore,
      missionId: projected.missionId,
      assignmentDecisionId: projected.assignmentDecisionId,
      assignmentPolicyId: projected.assignmentPolicyId,
      selectedTeamId: projected.selectedTeamId,
      founderOverride: projected.founderOverride,
      resolutionType: 'materialized',
      reasoning: 'mission_assignment_resolution_materialized',
    });

    return materialized;
  }

  return {
    evaluateAssignment,
    inspectAssignment,
    listAssignments,
    getSelectedTeam,
    getAlternativeTeams,
    getAssignmentStatus,
    getAssignmentHistory,
    confirmAssignment,
    overrideAssignment,
    materializeAssignment,
  };
}

export type MissionAssignmentInspection = ReturnType<typeof createMissionAssignmentInspection>;
