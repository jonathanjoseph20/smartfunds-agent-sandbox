import type {
  TeamStabilizationEvaluation,
  TeamStabilizationRules
} from './team-coordination-types.ts';

export function evaluateTeamStabilization(input: {
  teamId: string;
  healthySlotCount: number;
  unresolvedInvestigationCount: number;
  synthesisConflictCount: number;
  stabilizationRules: TeamStabilizationRules;
}): TeamStabilizationEvaluation {
  const reasons: string[] = [];

  if (input.healthySlotCount < input.stabilizationRules.requiredHealthySlots) {
    reasons.push(`healthy_slot_requirement_unmet:${String(input.healthySlotCount)}/${String(input.stabilizationRules.requiredHealthySlots)}`);
  }

  if (input.stabilizationRules.requireResolvedInvestigations && input.unresolvedInvestigationCount > 0) {
    reasons.push(`unresolved_investigations:${String(input.unresolvedInvestigationCount)}`);
  }

  if (input.stabilizationRules.requireClearedConflicts && input.synthesisConflictCount > 0) {
    reasons.push(`synthesis_conflicts:${String(input.synthesisConflictCount)}`);
  }

  return {
    teamId: input.teamId,
    stabilizationState: reasons.length === 0 ? 'resolved' : 'stabilizing',
    healthySlotCount: input.healthySlotCount,
    unresolvedInvestigationCount: input.unresolvedInvestigationCount,
    synthesisConflictCount: input.synthesisConflictCount,
    reasons
  };
}
