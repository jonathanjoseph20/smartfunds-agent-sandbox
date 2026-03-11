import {
  createResearchTeamAttachmentResolver,
  type ResearchTeamAttachmentResolver
} from './research-team-attachment.ts';
import {
  createResearchTeamHistoryStore,
  type ResearchTeamHistoryStore
} from './research-team-history.ts';
import {
  createResearchTeamMaterializer,
  type ResearchTeamMaterializer
} from './research-team-materializer.ts';
import {
  createResearchTeamProjection,
  type ResearchTeamProjectionEngine
} from './research-team-projection.ts';
import {
  createResearchTeamRegistry,
  type ResearchTeamRegistry
} from './research-team-registry.ts';
import {
  createResearchTeamStatusEvaluator,
  type ResearchTeamStatusEvaluator
} from './research-team-status.ts';
import {
  createTeamCoordinationInspection,
  type TeamCoordinationInspection
} from './coordination/team-coordination-inspection.ts';
import type { ResearchTeamHistoryEntry } from './research-team-types.ts';

function toEventType(activityState: string): ResearchTeamHistoryEntry['eventType'] {
  if (activityState === 'escalated_response') {
    return 'team_escalated';
  }
  if (activityState === 'active_response') {
    return 'team_activated';
  }
  if (activityState === 'stable') {
    return 'team_stabilized';
  }
  return 'team_deactivated';
}

function toEventReason(activityState: string): string {
  if (activityState === 'escalated_response') {
    return 'cohort_escalation_detected';
  }
  if (activityState === 'active_response') {
    return 'cohort_degradation_detected';
  }
  if (activityState === 'stable') {
    return 'all_linked_cohorts_stable';
  }
  if (activityState === 'monitoring') {
    return 'monitoring_without_active_response';
  }
  if (activityState === 'paused') {
    return 'team_paused';
  }
  return 'no_active_attachments';
}

export function createResearchTeamInspection(options: {
  registry?: ResearchTeamRegistry;
  attachmentResolver?: ResearchTeamAttachmentResolver;
  statusEvaluator?: ResearchTeamStatusEvaluator;
  projection?: ResearchTeamProjectionEngine;
  historyStore?: ResearchTeamHistoryStore;
  materializer?: ResearchTeamMaterializer;
  coordinationInspection?: TeamCoordinationInspection;
  artifactsRoot?: string;
  policyDefinitionsDir?: string;
  coordinationArtifactsRoot?: string;
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
  now?: () => Date;
} = {}) {
  const registry = options.registry ?? createResearchTeamRegistry({ definitionsDir: options.teamDefinitionsDir });
  const attachmentResolver = options.attachmentResolver ?? createResearchTeamAttachmentResolver({
    teamRegistry: registry,
    teamDefinitionsDir: options.teamDefinitionsDir,
    cohortDefinitionsDir: options.cohortDefinitionsDir
  });
  const statusEvaluator = options.statusEvaluator ?? createResearchTeamStatusEvaluator({
    teamRegistry: registry,
    attachmentResolver,
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
    now: options.now
  });
  const projection = options.projection ?? createResearchTeamProjection({
    registry,
    attachmentResolver,
    statusEvaluator,
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
    now: options.now
  });
  const historyStore = options.historyStore ?? createResearchTeamHistoryStore({
    artifactsRoot: options.artifactsRoot
  });
  const materializer = options.materializer ?? createResearchTeamMaterializer({
    projection,
    historyStore,
    artifactsRoot: options.artifactsRoot,
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
    now: options.now
  });
  const coordinationInspection = options.coordinationInspection ?? createTeamCoordinationInspection({
    teamDefinitionsDir: options.teamDefinitionsDir,
    policyDefinitionsDir: options.policyDefinitionsDir,
    cohortDefinitionsDir: options.cohortDefinitionsDir,
    cohortProgramDefinitionsDir: options.cohortProgramDefinitionsDir,
    cohortArtifactsRoot: options.cohortArtifactsRoot,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    coordinationArtifactsRoot: options.coordinationArtifactsRoot,
    now: options.now
  });

  function listTeams() {
    return registry.listResearchTeams().map((team) => ({
      teamId: team.teamId,
      displayName: team.displayName,
      teamType: team.teamType,
      enabled: team.enabled
    }));
  }

  function inspectTeam(teamId: string) {
    return projection.projectOne(teamId);
  }

  function inspectStatus(teamId: string) {
    return statusEvaluator.evaluateTeamStatus(teamId);
  }

  function inspectLinks(teamId: string) {
    const projected = projection.projectOne(teamId);
    return {
      teamId,
      cohorts: projected.status.linkedCohortIds,
      programs: projected.status.linkedProgramIds,
      investigations: projected.status.linkedInvestigationIds,
      syntheses: projected.status.linkedSynthesisIds
    };
  }

  function inspectHistory(teamId: string) {
    registry.getResearchTeam(teamId);
    return historyStore.load(teamId);
  }

  function evaluateTeam(input: { teamId: string; slotReference?: string }) {
    const projected = projection.projectOne(input.teamId);

    if (projected.attachments.length > 0) {
      historyStore.append({
        teamId: input.teamId,
        eventType: 'team_attached',
        reason: 'attachments_resolved',
        linkedCohortIds: projected.status.linkedCohortIds,
        linkedInvestigationIds: projected.status.linkedInvestigationIds,
        ...(input.slotReference ? { slotReference: input.slotReference } : {})
      });
    }

    historyStore.append({
      teamId: input.teamId,
      eventType: toEventType(projected.status.activityState),
      reason: toEventReason(projected.status.activityState),
      linkedCohortIds: projected.status.linkedCohortIds,
      linkedInvestigationIds: projected.status.linkedInvestigationIds,
      ...(input.slotReference ? { slotReference: input.slotReference } : {})
    });

    return {
      projection: projected,
      history: historyStore.load(input.teamId)
    };
  }

  function materializeTeam(input: { teamId: string; slotReference?: string }) {
    const evaluated = evaluateTeam(input);
    return materializer.materializeProjection({
      projection: evaluated.projection,
      history: evaluated.history
    });
  }

  function inspectCoordination(teamId: string) {
    return coordinationInspection.inspectCoordination(teamId);
  }

  function inspectCoordinationPolicy(teamId: string) {
    return coordinationInspection.inspectPolicy(teamId);
  }

  function inspectCoordinationPriorities(teamId: string) {
    return coordinationInspection.inspectPriorities(teamId);
  }

  function inspectCoordinationStabilization(teamId: string) {
    return coordinationInspection.inspectStabilization(teamId);
  }

  function evaluateCoordination(input: { teamId: string; slotReference?: string }) {
    return coordinationInspection.evaluateCoordination(input);
  }

  return {
    listTeams,
    inspectTeam,
    inspectStatus,
    inspectLinks,
    inspectHistory,
    evaluateTeam,
    materializeTeam,
    inspectCoordination,
    inspectCoordinationPolicy,
    inspectCoordinationPriorities,
    inspectCoordinationStabilization,
    evaluateCoordination
  };
}

export type ResearchTeamInspection = ReturnType<typeof createResearchTeamInspection>;
