import type {
  ArtifactVerification,
  BuildEvidenceGovernanceValidation,
  BuildEvidenceVerificationStatus,
  ExecutionPlanAttestation,
  PromptAttestation,
} from './build-evidence-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function deriveGovernanceValidationPosture(input: {
  artifactVerifications: ArtifactVerification[];
  promptAttestation: PromptAttestation;
  executionPlanAttestation: ExecutionPlanAttestation;
}): {
  governanceValidation: BuildEvidenceGovernanceValidation;
  verificationStatus: BuildEvidenceVerificationStatus;
  reasonTokens: string[];
} {
  const states = [
    ...input.artifactVerifications.map((entry) => entry.state),
    input.promptAttestation.state,
    input.executionPlanAttestation.state,
  ];

  const reasonTokens = uniqueSorted([
    ...input.artifactVerifications.flatMap((entry) => entry.reasonTokens),
    ...input.promptAttestation.reasonTokens,
    ...input.executionPlanAttestation.reasonTokens,
  ]);

  if (states.includes('failed')) {
    return {
      governanceValidation: 'failed',
      verificationStatus: 'failed',
      reasonTokens: uniqueSorted([...reasonTokens, 'governance_failed']),
    };
  }

  if (states.includes('blocked')) {
    return {
      governanceValidation: 'blocked',
      verificationStatus: 'blocked',
      reasonTokens: uniqueSorted([...reasonTokens, 'governance_blocked']),
    };
  }

  if (states.every((state) => state === 'verified')) {
    return {
      governanceValidation: 'valid',
      verificationStatus: 'verified',
      reasonTokens: uniqueSorted([...reasonTokens, 'governance_valid']),
    };
  }

  if (states.some((state) => state === 'verified') && states.some((state) => state === 'inconclusive')) {
    return {
      governanceValidation: 'partially_valid',
      verificationStatus: 'inconclusive',
      reasonTokens: uniqueSorted([...reasonTokens, 'governance_partially_valid']),
    };
  }

  return {
    governanceValidation: 'inconclusive',
    verificationStatus: 'inconclusive',
    reasonTokens: uniqueSorted([...reasonTokens, 'governance_inconclusive']),
  };
}
