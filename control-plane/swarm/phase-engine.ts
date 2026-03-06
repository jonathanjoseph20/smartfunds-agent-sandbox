import { SWARM_PHASES, type SwarmPhase } from './swarm-types.ts';

function phaseIndex(phase: SwarmPhase): number {
  return SWARM_PHASES.indexOf(phase);
}

export function getOrderedPhases(): SwarmPhase[] {
  return [...SWARM_PHASES];
}

export function getNextPhase(phase: SwarmPhase): SwarmPhase | null {
  const index = phaseIndex(phase);
  if (index < 0 || index >= SWARM_PHASES.length - 1) {
    return null;
  }
  return SWARM_PHASES[index + 1];
}

export function isTerminalPhase(phase: SwarmPhase): boolean {
  return phase === SWARM_PHASES[SWARM_PHASES.length - 1];
}

export function isValidPhaseTransition(from: SwarmPhase | null, to: SwarmPhase): boolean {
  if (!SWARM_PHASES.includes(to)) {
    return false;
  }
  if (from === null) {
    return to === SWARM_PHASES[0];
  }
  return getNextPhase(from) === to;
}

export function validatePhaseSequence(phases: SwarmPhase[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const seen = new Set<SwarmPhase>();

  for (let index = 0; index < phases.length; index += 1) {
    const phase = phases[index];

    if (!SWARM_PHASES.includes(phase)) {
      errors.push(`Unknown phase: ${String(phase)}`);
      continue;
    }

    if (seen.has(phase)) {
      errors.push(`Duplicate phase: ${phase}`);
    }
    seen.add(phase);

    const expected = SWARM_PHASES[index];
    if (phase !== expected) {
      errors.push(`Invalid phase order at index ${index}: expected ${expected}, received ${phase}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validatePhaseProgression(completedPhases: SwarmPhase[]): { valid: boolean; errors: string[] } {
  return validatePhaseSequence(completedPhases);
}
