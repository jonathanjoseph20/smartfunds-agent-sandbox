import type {
  AssignmentReadiness,
  CompatibilityClass,
  MissionTeamCompatibilityCandidate,
} from './team-compatibility-types.ts';

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function intersectTokens(left: string[], right: string[]): string[] {
  const rightSet = new Set(right.map((entry) => normalizeToken(entry)));
  return uniqueSorted(
    left
      .map((entry) => normalizeToken(entry))
      .filter((entry) => rightSet.has(entry)),
  );
}

export function matchesMissionType(input: { missionType: string; supportedMissionTypes: string[] }): boolean {
  const missionType = normalizeToken(input.missionType);
  return input.supportedMissionTypes.some((entry) => normalizeToken(entry) === missionType);
}

export function matchesTemplate(input: { templateId?: string; supportedTemplateIds: string[] }): boolean | null {
  if (!input.templateId) {
    return null;
  }

  const templateId = normalizeToken(input.templateId);
  return input.supportedTemplateIds.some((entry) => normalizeToken(entry) === templateId);
}

export function computeDomainOverlap(input: { missionDomainTags: string[]; teamDomainTags: string[] }): string[] {
  return intersectTokens(input.missionDomainTags, input.teamDomainTags);
}

export function computeCapabilityOverlap(input: { missionCapabilityHints: string[]; teamCapabilityTags: string[] }): string[] {
  return intersectTokens(input.missionCapabilityHints, input.teamCapabilityTags);
}

export function deriveCompatibilityClass(input: {
  supportedMissionType: boolean;
  supportedTemplateMatch: boolean | null;
  domainOverlap: string[];
  capabilityOverlap: string[];
  teamReadinessState: string;
}): CompatibilityClass {
  if (!input.supportedMissionType) {
    return 'unsupported';
  }

  if (input.supportedTemplateMatch === false) {
    return 'unsupported';
  }

  if (input.teamReadinessState === 'inconclusive') {
    return 'inconclusive';
  }

  const hasDomainOverlap = input.domainOverlap.length > 0;
  const hasCapabilityOverlap = input.capabilityOverlap.length > 0;

  if (hasDomainOverlap && hasCapabilityOverlap) {
    return 'strong_match';
  }

  if (hasDomainOverlap || hasCapabilityOverlap) {
    return 'partial_match';
  }

  return 'conditional_match';
}

export function deriveCandidateReadiness(input: {
  compatibilityClass: CompatibilityClass;
  lifecycleState: string;
  availabilityState: string;
  teamReadinessState: string;
  missionMetadataIncomplete: boolean;
  teamProfileIncomplete: boolean;
}): AssignmentReadiness {
  if (input.compatibilityClass === 'unsupported') {
    return 'blocked';
  }

  if (input.teamReadinessState === 'inconclusive' || input.compatibilityClass === 'inconclusive') {
    return 'inconclusive';
  }

  if (input.lifecycleState === 'archived' || input.lifecycleState === 'dormant') {
    return 'blocked';
  }

  if (input.availabilityState === 'unavailable') {
    return 'blocked';
  }

  if (input.teamReadinessState === 'blocked') {
    return 'blocked';
  }

  if (input.teamReadinessState === 'incomplete' || input.teamProfileIncomplete || input.missionMetadataIncomplete) {
    return 'incomplete';
  }

  if (
    input.availabilityState === 'manual_only'
    || input.availabilityState === 'restricted'
    || input.teamReadinessState === 'partial'
    || input.compatibilityClass === 'conditional_match'
  ) {
    return 'manual_review_required';
  }

  return 'ready';
}

export function buildRationaleTokens(input: {
  missionType: string;
  templateId?: string;
  supportedMissionType: boolean;
  supportedTemplateMatch: boolean | null;
  domainOverlap: string[];
  capabilityOverlap: string[];
  lifecycleState: string;
  availabilityState: string;
  teamReadinessState: string;
  missionMetadataIncomplete: boolean;
  teamProfileIncomplete: boolean;
}): {
  matchReasons: string[];
  blockingReasons: string[];
  limitations: string[];
} {
  const matchReasons: string[] = [];
  const blockingReasons: string[] = [];
  const limitations: string[] = [];

  if (input.supportedMissionType) {
    matchReasons.push(`supported_mission_type:${input.missionType}`);
  } else {
    blockingReasons.push('unsupported_mission_type');
  }

  if (input.templateId) {
    if (input.supportedTemplateMatch) {
      matchReasons.push(`supported_template:${input.templateId}`);
    } else if (input.supportedTemplateMatch === false) {
      blockingReasons.push('unsupported_template');
    }
  } else {
    limitations.push('template_id_unavailable');
  }

  for (const tag of input.domainOverlap) {
    matchReasons.push(`domain_overlap:${tag}`);
  }

  for (const tag of input.capabilityOverlap) {
    matchReasons.push(`capability_overlap:${tag}`);
  }

  if (input.availabilityState === 'manual_only') {
    limitations.push('availability_manual_only');
  }

  if (input.availabilityState === 'restricted') {
    limitations.push('availability_restricted');
  }

  if (input.availabilityState === 'unavailable') {
    blockingReasons.push('availability_unavailable');
  }

  if (input.lifecycleState === 'dormant') {
    blockingReasons.push('team_lifecycle_dormant');
  }

  if (input.lifecycleState === 'archived') {
    blockingReasons.push('team_lifecycle_archived');
  }

  if (input.teamReadinessState === 'partial') {
    limitations.push('team_readiness_partial');
  }

  if (input.teamReadinessState === 'blocked') {
    blockingReasons.push('team_readiness_blocked');
  }

  if (input.teamReadinessState === 'incomplete') {
    limitations.push('team_readiness_incomplete');
  }

  if (input.teamReadinessState === 'inconclusive') {
    limitations.push('team_readiness_inconclusive');
  }

  if (input.missionMetadataIncomplete) {
    limitations.push('mission_metadata_incomplete');
  }

  if (input.teamProfileIncomplete) {
    limitations.push('team_profile_incomplete');
  }

  return {
    matchReasons: uniqueSorted(matchReasons),
    blockingReasons: uniqueSorted(blockingReasons),
    limitations: uniqueSorted(limitations),
  };
}

const COMPATIBILITY_CLASS_PRIORITY: Record<CompatibilityClass, number> = {
  strong_match: 0,
  partial_match: 1,
  conditional_match: 2,
  unsupported: 3,
  inconclusive: 4,
};

const ASSIGNMENT_READINESS_PRIORITY: Record<AssignmentReadiness, number> = {
  ready: 0,
  manual_review_required: 1,
  incomplete: 2,
  blocked: 3,
  inconclusive: 4,
};

export function compareCandidates(left: MissionTeamCompatibilityCandidate, right: MissionTeamCompatibilityCandidate): number {
  const compatibilityCmp = COMPATIBILITY_CLASS_PRIORITY[left.compatibilityClass]
    - COMPATIBILITY_CLASS_PRIORITY[right.compatibilityClass];
  if (compatibilityCmp !== 0) {
    return compatibilityCmp;
  }

  const readinessCmp = ASSIGNMENT_READINESS_PRIORITY[left.assignmentReadiness]
    - ASSIGNMENT_READINESS_PRIORITY[right.assignmentReadiness];
  if (readinessCmp !== 0) {
    return readinessCmp;
  }

  return left.teamId.localeCompare(right.teamId);
}
