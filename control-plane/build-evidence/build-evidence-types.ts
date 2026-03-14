import type { ArtifactType, ExecutionPlan, GeneratedArtifact } from '../build-runtime/build-execution-types.ts';

export const BUILD_EVIDENCE_VERIFICATION_STATUSES = [
  'created',
  'verified',
  'blocked',
  'failed',
  'inconclusive',
] as const;

export const BUILD_EVIDENCE_GOVERNANCE_VALIDATION_VALUES = [
  'valid',
  'partially_valid',
  'blocked',
  'failed',
  'inconclusive',
] as const;

export const BUILD_EVIDENCE_OUTCOMES = [
  'verified',
  'partially_verified',
  'blocked',
  'failed',
  'inconclusive',
] as const;

export const ARTIFACT_VERIFICATION_CLASSES = [
  'artifact_hash_verified',
  'artifact_hash_mismatch',
  'artifact_missing',
  'artifact_unexpected',
  'artifact_inconclusive',
] as const;

export const PROMPT_ATTESTATION_CLASSES = [
  'prompt_verified',
  'prompt_mismatch',
  'prompt_missing',
  'prompt_inconclusive',
] as const;

export const EXECUTION_PLAN_ATTESTATION_CLASSES = [
  'execution_plan_verified',
  'execution_plan_mismatch',
  'execution_plan_partial',
  'execution_plan_inconclusive',
] as const;

export const BUILD_EVIDENCE_HISTORY_EVENT_TYPES = [
  'build_evidence_bundle_created',
  'artifact_verification_recorded',
  'prompt_attestation_recorded',
  'execution_plan_attestation_recorded',
  'build_evidence_governance_validated',
  'build_evidence_materialized',
  'build_evidence_failed',
] as const;

export type BuildEvidenceVerificationStatus = typeof BUILD_EVIDENCE_VERIFICATION_STATUSES[number];
export type BuildEvidenceGovernanceValidation = typeof BUILD_EVIDENCE_GOVERNANCE_VALIDATION_VALUES[number];
export type BuildEvidenceOutcome = typeof BUILD_EVIDENCE_OUTCOMES[number];
export type ArtifactVerificationClass = typeof ARTIFACT_VERIFICATION_CLASSES[number];
export type PromptAttestationClass = typeof PROMPT_ATTESTATION_CLASSES[number];
export type ExecutionPlanAttestationClass = typeof EXECUTION_PLAN_ATTESTATION_CLASSES[number];
export type BuildEvidenceHistoryEventType = typeof BUILD_EVIDENCE_HISTORY_EVENT_TYPES[number];

export type EvidenceCheckState = 'verified' | 'blocked' | 'failed' | 'inconclusive';

export type BuildEvidenceBundle = {
  buildEvidenceBundleId: string;
  runId: string;
  packetId: string;
  bundleId: string;
  promptHash: string;
  executionPlanHash: string;
  artifactHashes: Array<{
    artifactId: string;
    artifactClass: ArtifactType;
    filePath: string;
    contentHash: string;
  }>;
  verificationStatus: BuildEvidenceVerificationStatus;
  outcome: BuildEvidenceOutcome;
};

export type ArtifactVerification = {
  artifactVerificationId: string;
  buildEvidenceBundleId: string;
  artifactId: string;
  artifactClass: ArtifactType;
  verificationClass: ArtifactVerificationClass;
  reasonTokens: string[];
  state: EvidenceCheckState;
};

export type PromptAttestation = {
  promptAttestationId: string;
  buildEvidenceBundleId: string;
  packetId: string;
  promptHash: string;
  attestationClass: PromptAttestationClass;
  reasonTokens: string[];
  state: EvidenceCheckState;
};

export type ExecutionPlanAttestation = {
  executionPlanAttestationId: string;
  buildEvidenceBundleId: string;
  runId: string;
  executionPlanHash: string;
  attestationClass: ExecutionPlanAttestationClass;
  reasonTokens: string[];
  state: EvidenceCheckState;
};

export type BuildEvidenceHistoryEvent = {
  buildEvidenceBundleId: string;
  runId: string;
  eventType: BuildEvidenceHistoryEventType;
  payloadHash: string;
  payload: Record<string, unknown>;
};

export type BuildEvidenceInputs = {
  runId: string;
  packetId: string;
  bundleId: string;
  promptTemplate: string;
  executionPlan: ExecutionPlan;
  generatedArtifacts: GeneratedArtifact[];
};

export type BuildEvidenceProjection = {
  buildEvidenceBundleId: string;
  runId: string;
  packetId: string;
  bundleId: string;
  artifactVerificationSummaries: ArtifactVerification[];
  promptAttestationSummary: PromptAttestation;
  executionPlanAttestationSummary: ExecutionPlanAttestation;
  governanceValidation: BuildEvidenceGovernanceValidation;
  verificationStatus: BuildEvidenceVerificationStatus;
  outcome: BuildEvidenceOutcome;
  evidenceHistory: BuildEvidenceHistoryEvent[];
};

export type BuildEvidenceMaterializationSummary = {
  buildEvidenceBundleId: string;
  dirPath: string;
  statusPath: string;
  artifactVerificationPath: string;
  promptAttestationPath: string;
  executionPlanAttestationPath: string;
  historyPath: string;
  outcomePath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
};

export type BuildEvidenceCreateSummary = {
  buildEvidenceBundleId: string;
  runId: string;
  packetId: string;
  bundleId: string;
};
