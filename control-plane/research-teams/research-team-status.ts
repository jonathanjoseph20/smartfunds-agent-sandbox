import { createCohortInspection, type CohortInspection } from '../cohorts/cohort-inspection.ts';
import { createInvestigationInspection, type InvestigationInspection } from '../investigations/investigation-inspection.ts';
import { createSynthesisInspection, type SynthesisInspection } from '../synthesis/synthesis-inspection.ts';

import { createResearchTeamAttachmentResolver, type ResearchTeamAttachmentResolver } from './research-team-attachment.ts';
import { createResearchTeamRegistry, type ResearchTeamRegistry } from './research-team-registry.ts';
import type { ResearchTeamStatus } from './research-team-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export interface LinkedTeamWork {
  linkedCohortIds: string[];
  linkedProgramIds: string[];
  linkedInvestigationIds: string[];
  linkedSynthesisIds: string[];
}

function hasStableCohortHealth(health: string): boolean {
  return health === 'healthy';
}

function hasStableCohortReadiness(readiness: string): boolean {
  return readiness === 'ready' || readiness === 'completed';
}

function hasInvestigationFailure(healthState: string): boolean {
  return healthState === 'unhealthy' || healthState === 'degraded' || healthState === 'inconclusive';
}

export function createResearchTeamStatusEvaluator(options: {
  teamRegistry?: ResearchTeamRegistry;
  attachmentResolver?: ResearchTeamAttachmentResolver;
  cohortInspection?: CohortInspection;
  investigationInspection?: InvestigationInspection;
  synthesisInspection?: SynthesisInspection;
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
  const teamRegistry = options.teamRegistry ?? createResearchTeamRegistry({ definitionsDir: options.teamDefinitionsDir });
  const attachmentResolver = options.attachmentResolver ?? createResearchTeamAttachmentResolver({
    teamRegistry,
    teamDefinitionsDir: options.teamDefinitionsDir,
    cohortDefinitionsDir: options.cohortDefinitionsDir
  });
  const cohortInspection = options.cohortInspection ?? createCohortInspection({
    definitionsDir: options.cohortDefinitionsDir,
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
  const investigationInspection = options.investigationInspection ?? createInvestigationInspection({
    definitionsDir: options.investigationDefinitionsDir,
    rootDir: options.investigationsRootDir,
    artifactsRoot: options.investigationArtifactsRoot
  });
  const synthesisInspection = options.synthesisInspection ?? createSynthesisInspection({
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    signalsRootDir: options.signalsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot
  });

  function listLinkedWork(teamId: string): LinkedTeamWork {
    const attachments = attachmentResolver.resolveAttachmentsForTeam(teamId);
    const linkedCohortIds = attachments.map((entry) => entry.cohortId).sort((left, right) => left.localeCompare(right));

    const linkedProgramIds = uniqueSorted(linkedCohortIds
      .flatMap((cohortId) => cohortInspection.listCohortPrograms(cohortId).map((program) => program.programId)));

    const linkedInvestigationIds = uniqueSorted(linkedCohortIds
      .flatMap((cohortId) => cohortInspection.inspectLinks(cohortId).linkedInvestigations));

    const linkedSynthesisIds = uniqueSorted(linkedCohortIds
      .flatMap((cohortId) => cohortInspection.inspectLinks(cohortId).linkedSyntheses));

    return {
      linkedCohortIds,
      linkedProgramIds,
      linkedInvestigationIds,
      linkedSynthesisIds
    };
  }

  function evaluateTeamStatus(teamId: string): ResearchTeamStatus {
    const team = teamRegistry.getResearchTeam(teamId);
    const linkedWork = listLinkedWork(teamId);

    if (!team.enabled) {
      return {
        teamId,
        activityState: 'paused',
        healthState: 'idle',
        linkedCohortIds: linkedWork.linkedCohortIds,
        linkedProgramIds: linkedWork.linkedProgramIds,
        linkedInvestigationIds: linkedWork.linkedInvestigationIds,
        linkedSynthesisIds: linkedWork.linkedSynthesisIds,
        responseReasons: ['team_disabled']
      };
    }

    if (linkedWork.linkedCohortIds.length === 0) {
      return {
        teamId,
        activityState: 'inactive',
        healthState: 'idle',
        linkedCohortIds: [],
        linkedProgramIds: [],
        linkedInvestigationIds: [],
        linkedSynthesisIds: [],
        responseReasons: ['no_attached_cohorts']
      };
    }

    const cohortStates = linkedWork.linkedCohortIds.map((cohortId) => {
      const status = cohortInspection.inspectStatus(cohortId);
      const escalation = cohortInspection.inspectCohortEscalation({ cohortId });
      return {
        cohortId,
        readiness: status.readiness,
        health: status.health,
        escalationState: escalation.escalationState
      };
    });

    const synthesisConflictCount = linkedWork.linkedSynthesisIds
      .map((synthesisId) => synthesisInspection.inspectConflicts(synthesisId).conflicts.length)
      .reduce((total, count) => total + count, 0);

    const investigationFailureIds = linkedWork.linkedInvestigationIds
      .filter((investigationId) => hasInvestigationFailure(investigationInspection.inspectCompletionStatus(investigationId).healthState))
      .sort((left, right) => left.localeCompare(right));

    const hasEscalated = cohortStates.some((entry) => entry.escalationState === 'escalated' || entry.escalationState === 'critical');
    const hasDegraded = cohortStates.some((entry) => entry.health === 'degraded' || entry.health === 'conflicted' || entry.health === 'unstable')
      || cohortStates.some((entry) => entry.escalationState === 'elevated');
    const allStable = cohortStates.every((entry) => (
      entry.escalationState === 'none'
      && hasStableCohortHealth(entry.health)
      && hasStableCohortReadiness(entry.readiness)
    ));

    const responseReasons: string[] = [];

    if (hasEscalated) {
      responseReasons.push('cohort_escalated');
    }
    if (hasDegraded) {
      responseReasons.push('cohort_degraded');
    }
    if (!hasEscalated && !hasDegraded) {
      responseReasons.push('no_escalation_signals');
    }
    if (allStable) {
      responseReasons.push('all_linked_cohorts_stable');
    }
    if (synthesisConflictCount > 0) {
      responseReasons.push(`synthesis_conflicts:${String(synthesisConflictCount)}`);
    }
    if (investigationFailureIds.length > 0) {
      responseReasons.push(`investigation_failures:${String(investigationFailureIds.length)}`);
    }

    const activityState: ResearchTeamStatus['activityState'] = hasEscalated
      ? 'escalated_response'
      : hasDegraded
        ? 'active_response'
        : allStable
          ? 'stable'
          : 'monitoring';

    const healthState: ResearchTeamStatus['healthState'] = cohortStates.some((entry) => entry.health === 'unstable')
      ? 'unstable'
      : synthesisConflictCount > 0
        ? 'conflicted'
        : investigationFailureIds.length >= 3
          ? 'overloaded'
          : (hasDegraded || investigationFailureIds.length > 0)
            ? 'active'
            : 'healthy';

    return {
      teamId,
      activityState,
      healthState,
      linkedCohortIds: linkedWork.linkedCohortIds,
      linkedProgramIds: linkedWork.linkedProgramIds,
      linkedInvestigationIds: linkedWork.linkedInvestigationIds,
      linkedSynthesisIds: linkedWork.linkedSynthesisIds,
      responseReasons: uniqueSorted(responseReasons)
    };
  }

  return {
    listLinkedWork,
    evaluateTeamStatus
  };
}

export type ResearchTeamStatusEvaluator = ReturnType<typeof createResearchTeamStatusEvaluator>;
