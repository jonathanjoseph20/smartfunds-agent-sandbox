import { describe, expect, it } from 'vitest';

import { deriveBuildEvidenceOutcome } from '../../build-evidence/build-evidence-outcome.ts';
import { deriveGovernanceValidationPosture } from '../../build-evidence/build-evidence-status.ts';

describe('build evidence status and outcome', () => {
  it('T-PF7-S1 maps fully verified checks to valid governance and verified outcome', () => {
    const posture = deriveGovernanceValidationPosture({
      artifactVerifications: [{ state: 'verified', reasonTokens: ['ok'] }] as never,
      promptAttestation: { state: 'verified', reasonTokens: ['ok'] } as never,
      executionPlanAttestation: { state: 'verified', reasonTokens: ['ok'] } as never,
    });

    expect(posture.governanceValidation).toBe('valid');
    expect(deriveBuildEvidenceOutcome(posture.governanceValidation)).toBe('verified');
  });

  it('T-PF7-S2 maps blocked and failed states conservatively', () => {
    const blocked = deriveGovernanceValidationPosture({
      artifactVerifications: [{ state: 'blocked', reasonTokens: ['blocked'] }] as never,
      promptAttestation: { state: 'verified', reasonTokens: ['ok'] } as never,
      executionPlanAttestation: { state: 'verified', reasonTokens: ['ok'] } as never,
    });

    const failed = deriveGovernanceValidationPosture({
      artifactVerifications: [{ state: 'failed', reasonTokens: ['failed'] }] as never,
      promptAttestation: { state: 'verified', reasonTokens: ['ok'] } as never,
      executionPlanAttestation: { state: 'verified', reasonTokens: ['ok'] } as never,
    });

    expect(blocked.governanceValidation).toBe('blocked');
    expect(failed.governanceValidation).toBe('failed');
    expect(deriveBuildEvidenceOutcome(blocked.governanceValidation)).toBe('blocked');
    expect(deriveBuildEvidenceOutcome(failed.governanceValidation)).toBe('failed');
  });
});
