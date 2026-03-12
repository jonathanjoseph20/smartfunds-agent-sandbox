import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import {
  createMissionProjection,
  type MissionProjectionEngine,
} from '../missions/mission-projection.ts';
import {
  createTeamProjection,
  type TeamProjectionEngine,
} from '../teams/team-projection.ts';

import {
  buildRationaleTokens,
  compareCandidates,
  computeCapabilityOverlap,
  computeDomainOverlap,
  deriveCandidateReadiness,
  deriveCompatibilityClass,
  matchesMissionType,
  matchesTemplate,
} from './team-compatibility-rules.ts';
import {
  deriveCompatibilitySetState,
  summarizeCompatibilityCounts,
} from './team-compatibility-status.ts';
import type {
  MissionTeamCompatibilityCandidate,
  TeamCompatibilityEvaluationResult,
} from './team-compatibility-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim())
    .sort((left, right) => left.localeCompare(right));
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function extractMissionCapabilityHints(instanceRecord: Record<string, unknown>): string[] {
  const requested = instanceRecord.requestedDeliverables;
  if (!Array.isArray(requested)) {
    return [];
  }

  const values = requested.flatMap((entry) => {
    if (typeof entry === 'string') {
      return [entry];
    }
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return [];
    }

    const deliverableId = asOptionalString((entry as Record<string, unknown>).deliverableId);
    const description = asOptionalString((entry as Record<string, unknown>).description);
    return [deliverableId, description].filter((candidate): candidate is string => Boolean(candidate));
  });

  return uniqueSorted(values.map((entry) => entry.toLowerCase()));
}

function extractMissionDomainTags(definitionRecord: Record<string, unknown>): string[] {
  return uniqueSorted(asStringArray(definitionRecord.tags).map((entry) => entry.toLowerCase()));
}

function deriveCompatibilitySetId(input: {
  missionId: string;
  missionType: string;
  templateId?: string;
  rulesetVersion: string;
  candidateTeams: MissionTeamCompatibilityCandidate[];
}): string {
  const identityPayload = {
    missionId: input.missionId,
    missionType: input.missionType,
    templateId: input.templateId ?? '',
    rulesetVersion: input.rulesetVersion,
    candidateTeams: input.candidateTeams.map((entry) => ({
      teamId: entry.teamId,
      compatibilityClass: entry.compatibilityClass,
      assignmentReadiness: entry.assignmentReadiness,
      matchReasons: entry.matchReasons,
      blockingReasons: entry.blockingReasons,
      limitations: entry.limitations,
      supportedMissionType: entry.supportedMissionType,
      supportedTemplateMatch: entry.supportedTemplateMatch,
      domainOverlap: entry.domainOverlap,
      capabilityOverlap: entry.capabilityOverlap,
      availabilityState: entry.availabilityState,
      teamReadinessState: entry.teamReadinessState,
      teamLifecycleState: entry.teamLifecycleState,
    })),
  };

  return sha256(canonicalStringify(identityPayload));
}

export function createTeamCompatibilityEvaluator(options: {
  missionProjection?: MissionProjectionEngine;
  teamProjection?: TeamProjectionEngine;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  rulesetVersion?: string;
} = {}) {
  const missionProjection = options.missionProjection ?? createMissionProjection({
    definitionsDir: options.missionDefinitionsDir,
    instancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
  });

  const teamProjection = options.teamProjection ?? createTeamProjection({
    definitionsDir: options.teamDefinitionsDir,
  });

  const rulesetVersion = options.rulesetVersion ?? 'team_compatibility_v1';

  function evaluateMissionCompatibility(missionId: string): TeamCompatibilityEvaluationResult {
    const mission = missionProjection.projectOne(missionId);
    const missionDefinition = mission.definition as Record<string, unknown>;
    const missionInstance = mission.instance as Record<string, unknown>;

    const templateId = asOptionalString(missionInstance.templateId);
    const missionDomainTags = extractMissionDomainTags(missionDefinition);
    const missionCapabilityHints = extractMissionCapabilityHints(missionInstance);
    const missionMetadataIncomplete = missionDomainTags.length === 0 && missionCapabilityHints.length === 0;

    const candidates = teamProjection
      .projectAll()
      .map((teamProjectionEntry) => {
        const supportedMissionType = matchesMissionType({
          missionType: mission.missionType,
          supportedMissionTypes: teamProjectionEntry.definition.supportedMissionTypes,
        });

        const supportedTemplateMatch = matchesTemplate({
          templateId,
          supportedTemplateIds: teamProjectionEntry.definition.supportedTemplateIds,
        });

        const domainOverlap = computeDomainOverlap({
          missionDomainTags,
          teamDomainTags: teamProjectionEntry.definition.domainTags,
        });

        const capabilityOverlap = computeCapabilityOverlap({
          missionCapabilityHints,
          teamCapabilityTags: teamProjectionEntry.definition.capabilityTags,
        });

        const teamProfileIncomplete = teamProjectionEntry.definition.supportedMissionTypes.length === 0
          || teamProjectionEntry.definition.supportedTemplateIds.length === 0
          || teamProjectionEntry.definition.capabilityTags.length === 0;

        const compatibilityClass = deriveCompatibilityClass({
          supportedMissionType,
          supportedTemplateMatch,
          domainOverlap,
          capabilityOverlap,
          teamReadinessState: teamProjectionEntry.status.readinessState,
        });

        const assignmentReadiness = deriveCandidateReadiness({
          compatibilityClass,
          lifecycleState: teamProjectionEntry.status.lifecycleState,
          availabilityState: teamProjectionEntry.status.availabilityState,
          teamReadinessState: teamProjectionEntry.status.readinessState,
          missionMetadataIncomplete,
          teamProfileIncomplete,
        });

        const rationale = buildRationaleTokens({
          missionType: mission.missionType,
          templateId,
          supportedMissionType,
          supportedTemplateMatch,
          domainOverlap,
          capabilityOverlap,
          lifecycleState: teamProjectionEntry.status.lifecycleState,
          availabilityState: teamProjectionEntry.status.availabilityState,
          teamReadinessState: teamProjectionEntry.status.readinessState,
          missionMetadataIncomplete,
          teamProfileIncomplete,
        });

        const candidate: MissionTeamCompatibilityCandidate = {
          teamId: teamProjectionEntry.teamId,
          compatibilityClass,
          assignmentReadiness,
          matchReasons: rationale.matchReasons,
          blockingReasons: rationale.blockingReasons,
          limitations: rationale.limitations,
          supportedMissionType,
          supportedTemplateMatch,
          domainOverlap,
          capabilityOverlap,
          availabilityState: teamProjectionEntry.status.availabilityState,
          teamReadinessState: teamProjectionEntry.status.readinessState,
          teamLifecycleState: teamProjectionEntry.status.lifecycleState,
        };

        return candidate;
      })
      .sort(compareCandidates);

    const compatibilityState = deriveCompatibilitySetState({ candidateTeams: candidates });
    const counts = summarizeCompatibilityCounts({ candidateTeams: candidates });
    const compatibilitySetId = deriveCompatibilitySetId({
      missionId: mission.missionId,
      missionType: mission.missionType,
      templateId,
      rulesetVersion,
      candidateTeams: candidates,
    });

    const limitations = uniqueSorted([
      'compatibility_pre_assignment_only',
      ...(missionMetadataIncomplete ? ['mission_metadata_incomplete'] : []),
      ...(templateId ? [] : ['template_id_unavailable']),
      ...(candidates.length === 0 ? ['no_registered_teams'] : []),
    ]);

    return {
      compatibilityState,
      compatibilitySet: {
        compatibilitySetId,
        missionId: mission.missionId,
        missionType: mission.missionType,
        ...(templateId ? { templateId } : {}),
        candidateTeams: candidates,
        supportedTeamCount: counts.supportedTeamCount,
        blockedTeamCount: counts.blockedTeamCount,
        manualReviewTeamCount: counts.manualReviewTeamCount,
        unsupportedTeamCount: counts.unsupportedTeamCount,
        compatibilityState,
        limitations,
        historyDigest: '',
      },
    };
  }

  function evaluateAllMissionCompatibility(): TeamCompatibilityEvaluationResult[] {
    return missionProjection
      .projectAll()
      .map((entry) => evaluateMissionCompatibility(entry.missionId))
      .sort((left, right) => left.compatibilitySet.missionId.localeCompare(right.compatibilitySet.missionId));
  }

  return {
    evaluateMissionCompatibility,
    evaluateAllMissionCompatibility,
  };
}

export type TeamCompatibilityEvaluator = ReturnType<typeof createTeamCompatibilityEvaluator>;
