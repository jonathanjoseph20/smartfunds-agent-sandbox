import type { TeamRoutingDecision, TeamRoutingRule } from './team-coordination-types.ts';

function isEscalatedState(state: string | undefined): boolean {
  return state === 'elevated' || state === 'escalated' || state === 'critical';
}

export function routeTeamInvestigation(input: {
  teamId: string;
  linkedCohortIds: string[];
  cohortEscalationStates: Record<string, string>;
  routingRules: TeamRoutingRule[];
}): TeamRoutingDecision | null {
  const linked = [...input.linkedCohortIds].sort((left, right) => left.localeCompare(right));

  for (const rule of input.routingRules) {
    if (!linked.includes(rule.cohort)) {
      continue;
    }

    const escalationState = input.cohortEscalationStates[rule.cohort];
    if (!isEscalatedState(escalationState)) {
      continue;
    }

    return {
      teamId: input.teamId,
      investigationTemplate: rule.investigationTemplate,
      matchedCohortId: rule.cohort,
      reason: `routing_rule_match:${rule.cohort}:escalation_${escalationState}`
    };
  }

  return null;
}
