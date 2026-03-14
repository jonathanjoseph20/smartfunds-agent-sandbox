import type { BuildEvidenceGovernanceValidation, BuildEvidenceOutcome } from './build-evidence-types.ts';

export function deriveBuildEvidenceOutcome(governanceValidation: BuildEvidenceGovernanceValidation): BuildEvidenceOutcome {
  if (governanceValidation === 'valid') {
    return 'verified';
  }
  if (governanceValidation === 'partially_valid') {
    return 'partially_verified';
  }
  if (governanceValidation === 'blocked') {
    return 'blocked';
  }
  if (governanceValidation === 'failed') {
    return 'failed';
  }
  return 'inconclusive';
}
