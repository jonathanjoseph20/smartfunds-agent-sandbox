import { createCohortInspection, type CohortInspection } from '../cohorts/cohort-inspection.ts';

import { createResearchTeamAttachmentResolver, type ResearchTeamAttachmentResolver } from './research-team-attachment.ts';
import { createResearchTeamRegistry, type ResearchTeamRegistry } from './research-team-registry.ts';
import { createResearchTeamStatusEvaluator, type ResearchTeamStatusEvaluator } from './research-team-status.ts';
import type { ResearchTeamProjection } from './research-team-types.ts';

export function createResearchTeamProjection(options: {
  registry?: ResearchTeamRegistry;
  attachmentResolver?: ResearchTeamAttachmentResolver;
  statusEvaluator?: ResearchTeamStatusEvaluator;
  cohortInspection?: CohortInspection;
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

  function projectOne(teamId: string): ResearchTeamProjection {
    const team = registry.getResearchTeam(teamId);
    const attachments = attachmentResolver.resolveAttachmentsForTeam(teamId);
    const status = statusEvaluator.evaluateTeamStatus(teamId);

    const linkedPrograms = attachments
      .flatMap((attachment) => cohortInspection.listCohortPrograms(attachment.cohortId).map((program) => ({
        cohortId: attachment.cohortId,
        programId: program.programId
      })))
      .sort((left, right) => {
        const cohortCmp = left.cohortId.localeCompare(right.cohortId);
        if (cohortCmp !== 0) {
          return cohortCmp;
        }
        return left.programId.localeCompare(right.programId);
      });

    return {
      team,
      attachments,
      status,
      linkedPrograms,
      linkedInvestigations: status.linkedInvestigationIds,
      linkedSyntheses: status.linkedSynthesisIds
    };
  }

  function projectAll(): ResearchTeamProjection[] {
    return registry.listResearchTeams()
      .map((team) => projectOne(team.teamId))
      .sort((left, right) => left.team.teamId.localeCompare(right.team.teamId));
  }

  return {
    projectOne,
    projectAll
  };
}

export type ResearchTeamProjectionEngine = ReturnType<typeof createResearchTeamProjection>;
