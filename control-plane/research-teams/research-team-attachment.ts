import { createCohortRegistry, type CohortRegistry } from '../cohorts/cohort-registry.ts';

import { createResearchTeamRegistry, type ResearchTeamRegistry } from './research-team-registry.ts';
import type { ResearchTeamAttachment, ResearchTeamAttachmentContext } from './research-team-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function asSubjectFamily(subjectKey: string): string {
  const parts = normalize(subjectKey).split(':');
  return parts[0] ?? normalize(subjectKey);
}

function asTopicCategory(cohortType: string): string {
  const parts = normalize(cohortType).split('-');
  return parts[parts.length - 1] ?? normalize(cohortType);
}

function includesNormalized(values: string[] | undefined, candidate: string): boolean {
  if (!values || values.length === 0) {
    return false;
  }

  const normalizedCandidate = normalize(candidate);
  return values.some((entry) => normalize(entry) === normalizedCandidate);
}

function explainAttachment(input: {
  context: ResearchTeamAttachmentContext;
  rules: {
    cohortIds?: string[];
    cohortTypes?: string[];
    subjectFamilies?: string[];
    topicCategories?: string[];
  };
}): string[] {
  const reasons: string[] = [];

  if (includesNormalized(input.rules.cohortIds, input.context.cohortId)) {
    reasons.push(`cohort_id_match:${input.context.cohortId}`);
  }
  if (includesNormalized(input.rules.cohortTypes, input.context.cohortType)) {
    reasons.push(`cohort_type_match:${input.context.cohortType}`);
  }

  const subjectFamily = asSubjectFamily(input.context.subjectKey);
  if (includesNormalized(input.rules.subjectFamilies, subjectFamily)) {
    reasons.push(`subject_family_match:${subjectFamily}`);
  }

  const topicCategory = asTopicCategory(input.context.cohortType);
  if (includesNormalized(input.rules.topicCategories, topicCategory)) {
    reasons.push(`topic_category_match:${topicCategory}`);
  }

  return uniqueSorted(reasons);
}

export function createResearchTeamAttachmentResolver(options: {
  teamRegistry?: ResearchTeamRegistry;
  cohortRegistry?: CohortRegistry;
  teamDefinitionsDir?: string;
  cohortDefinitionsDir?: string;
} = {}) {
  const teamRegistry = options.teamRegistry ?? createResearchTeamRegistry({ definitionsDir: options.teamDefinitionsDir });
  const cohortRegistry = options.cohortRegistry ?? createCohortRegistry({ definitionsDir: options.cohortDefinitionsDir });

  function resolveAttachmentsForCohort(context: ResearchTeamAttachmentContext): ResearchTeamAttachment[] {
    return teamRegistry.listResearchTeams()
      .map((team) => {
        const attachmentReason = explainAttachment({
          context,
          rules: team.attachmentRules
        });

        return {
          teamId: team.teamId,
          cohortId: context.cohortId,
          attachmentReason
        };
      })
      .filter((entry) => entry.attachmentReason.length > 0)
      .sort((left, right) => left.teamId.localeCompare(right.teamId));
  }

  function resolveAttachmentsForAllCohorts(): ResearchTeamAttachment[] {
    return cohortRegistry.listCohorts()
      .flatMap((cohort) => resolveAttachmentsForCohort({
        cohortId: cohort.cohortId,
        cohortType: cohort.cohortType,
        subjectKey: cohort.subjectKey
      }))
      .sort((left, right) => {
        const teamCmp = left.teamId.localeCompare(right.teamId);
        if (teamCmp !== 0) {
          return teamCmp;
        }
        return left.cohortId.localeCompare(right.cohortId);
      });
  }

  function resolveAttachmentsForTeam(teamId: string): ResearchTeamAttachment[] {
    teamRegistry.getResearchTeam(teamId);

    return resolveAttachmentsForAllCohorts()
      .filter((entry) => entry.teamId === teamId)
      .sort((left, right) => left.cohortId.localeCompare(right.cohortId));
  }

  return {
    resolveAttachmentsForCohort,
    resolveAttachmentsForAllCohorts,
    resolveAttachmentsForTeam
  };
}

export type ResearchTeamAttachmentResolver = ReturnType<typeof createResearchTeamAttachmentResolver>;
