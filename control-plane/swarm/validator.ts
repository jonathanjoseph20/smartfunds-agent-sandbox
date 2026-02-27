import type { ExecutionMode } from '../teams/types.ts';
import type { SwarmMode } from './schema.ts';

export type SwarmValidationInput = {
  swarmsDeclared: string[];
  swarmMode: SwarmMode | null;
  swarmTeamId: string | null;
  hasSwarmModeField: boolean;
  hasSwarmTeamField: boolean;
  swarmWarnings: string[];
  executionModesTouched: ExecutionMode[];
};

export type SwarmValidationResult = {
  swarmsTouched: string[];
  swarmWarnings: string[];
  swarmErrors: string[];
};

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export function evaluateSwarmPolicy(input: SwarmValidationInput): SwarmValidationResult {
  const warnings: string[] = [...input.swarmWarnings];
  const errors: string[] = [];
  const swarmsTouched = sortedUnique(input.swarmsDeclared);

  if (input.swarmsDeclared.length > 1) {
    warnings.push('multiple_swarms_declared');
  }
  if (input.hasSwarmTeamField && input.swarmsDeclared.length === 0) {
    warnings.push('swarm_team_without_swarm');
  }
  if (input.hasSwarmModeField && input.swarmsDeclared.length === 0) {
    warnings.push('swarm_mode_without_swarm');
  }
  if (input.swarmMode === 'autonomous' && input.executionModesTouched.includes('structured')) {
    errors.push('swarm_autonomous_structured_violation');
  }

  return {
    swarmsTouched,
    swarmWarnings: sortedUnique(warnings),
    swarmErrors: sortedUnique(errors)
  };
}
