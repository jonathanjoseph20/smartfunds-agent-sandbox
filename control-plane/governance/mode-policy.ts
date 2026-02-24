import type { ExecutionMode } from '../teams/types';

export type ModeEnforcementStatus = 'ok' | 'failed';
export type ModeViolation = null | 'mixed_execution_modes' | 'structured_min_tier_violation';

export type ModePolicyResult = {
  status: ModeEnforcementStatus;
  violation: ModeViolation;
  requiredMinimumTier: number | null;
  message: string | null;
  nextActions: string[];
};

export function evaluateModePolicy(params: {
  executionModesTouched: ExecutionMode[];
  declaredTier: number | null;
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

  if (hasStructured && (params.declaredTier === null || params.declaredTier < 2)) {
    return {
      status: 'failed',
      violation: 'structured_min_tier_violation',
      requiredMinimumTier: 2,
      message:
        'Mode policy violation: structured execution mode requires declared tier-2 or tier-3. Raise the declared tier and align PR metadata/evidence.',
      nextActions: ['Raise declared tier to tier-2 or tier-3 and align PR metadata/evidence.']
    };
  }

  return {
    status: 'ok',
    violation: null,
    requiredMinimumTier: hasStructured ? 2 : null,
    message: null,
    nextActions: []
  };
}
