import type { TeamDefinition, TeamStatusProjection, TeamValidationIssue } from './team-definition-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function hasPlaceholderRoster(definition: TeamDefinition): boolean {
  if (definition.rosterPolicy.type === 'placeholder') {
    return true;
  }
  return definition.rosterPolicy.requiredCapabilities.length === 0;
}

export function evaluateTeamStatus(input: {
  definition: TeamDefinition;
  validationIssues?: TeamValidationIssue[];
}): TeamStatusProjection {
  const definition = input.definition;
  const issues = input.validationIssues ?? [];

  const blockingReasons = issues
    .filter((issue) => {
      return issue.code === 'required'
        || issue.code === 'required_array'
        || issue.code === 'required_non_empty'
        || issue.code === 'invalid_enum'
        || issue.code === 'invalid_mission_type_reference'
        || issue.code === 'invalid_template_reference'
        || issue.code === 'invalid_bounds'
        || issue.code === 'invalid_number'
        || issue.code === 'archived_team_available'
        || issue.code === 'invalid_lifecycle_availability_combination'
        || issue.code === 'missing_required_capabilities'
        || issue.code === 'duplicate_entries'
        || issue.code === 'duplicate_team_id';
    })
    .map((issue) => `${issue.field}:${issue.code}`);

  const limitations = [
    'team_invocation_not_available_in_sprint_4_1',
  ];

  if (definition.supportedMissionTypes.length === 0 || definition.supportedTemplateIds.length === 0) {
    limitations.push('support_mappings_incomplete');
  }

  if (hasPlaceholderRoster(definition)) {
    limitations.push('placeholder_roster_policy');
  }

  const contradictory =
    definition.lifecycleState === 'archived' && definition.availabilityState === 'available';

  const hasInvalidReferences = issues.some((issue) => {
    return issue.code === 'invalid_mission_type_reference' || issue.code === 'invalid_template_reference';
  });

  const hasHardBlockers = blockingReasons.length > 0 || contradictory;

  let readinessState: TeamStatusProjection['readinessState'];

  if (contradictory && issues.length > 1) {
    readinessState = 'inconclusive';
  } else if (hasHardBlockers || hasInvalidReferences) {
    readinessState = 'blocked';
  } else if (definition.supportedMissionTypes.length === 0 || definition.supportedTemplateIds.length === 0) {
    readinessState = 'incomplete';
  } else if (hasPlaceholderRoster(definition) || definition.lifecycleState === 'dormant') {
    readinessState = 'partial';
  } else {
    readinessState = 'ready';
  }

  if (definition.lifecycleState === 'dormant' && definition.defaultOperatingMode === 'dormant_reserve' && !hasHardBlockers) {
    readinessState = hasPlaceholderRoster(definition) ? 'partial' : 'ready';
  }

  return {
    teamId: definition.teamId,
    lifecycleState: definition.lifecycleState,
    availabilityState: definition.availabilityState,
    readinessState,
    blockingReasons: uniqueSorted(blockingReasons),
    limitations: uniqueSorted(limitations),
  };
}
