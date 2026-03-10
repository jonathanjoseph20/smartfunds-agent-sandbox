import type { ExecutionMode } from '../teams/types';

export type ModeEnforcementStatus = 'ok' | 'failed';
export type ModeViolation = null | 'mixed_execution_modes';

export type ModePolicyResult = {
  status: ModeEnforcementStatus;
  violation: ModeViolation;
  requiredMinimumTier: number | null;
  message: string | null;
  nextActions: string[];
};

export function evaluateModePolicy(params: {
  executionModesTouched: ExecutionMode[];
}): ModePolicyResult {
  const hasStructured = params.executionModesTouched.includes('structured');
  const hasAutonomous = params.executionModesTouched.includes('autonomous');

  if (hasStructured && hasAutonomous) {
    return {
      status: 'failed',
      violation: 'mixed_execution_modes',
      requiredMinimumTier: null,
      message:
        'Mode policy violation: mixed execution modes detected (structured and autonomous). Split changes into separate PRs so each PR uses exactly one execution mode.',
      nextActions: ['Split changes into separate PRs so each PR uses exactly one execution mode.']
    };
  }

  return {
    status: 'ok',
    violation: null,
    requiredMinimumTier: null,
    message: null,
    nextActions: []
  };
}
