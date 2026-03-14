import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import type { BuildExecutionRun } from '../build-runtime/build-execution-types.ts';
import type { CodexExecutionPacket } from '../codex/codex-execution-packet-types.ts';

import { verifyArtifactsForBuildEvidence } from './artifact-verification.ts';
import { deriveBuildEvidenceOutcome } from './build-evidence-outcome.ts';
import { deriveGovernanceValidationPosture } from './build-evidence-status.ts';
import { attestBuildEvidenceExecutionPlan } from './execution-plan-attestation.ts';
import { attestBuildEvidencePrompt } from './prompt-attestation.ts';
import type {
  BuildEvidenceBundle,
  BuildEvidenceHistoryEvent,
  BuildEvidenceProjection,
} from './build-evidence-types.ts';

function toExpectedArtifactHashMap(bundle: BuildEvidenceBundle): Record<string, string> {
  return Object.fromEntries(
    [...bundle.artifactHashes]
      .map((artifact) => [`${artifact.filePath}::${artifact.artifactClass}`, artifact.contentHash] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function toPayloadHash(payload: unknown): string {
  return sha256(canonicalStringify(payload));
}

export function projectBuildEvidenceBundle(input: {
  bundle: BuildEvidenceBundle;
  run: Pick<BuildExecutionRun, 'executionPlan' | 'generatedArtifacts'>;
  packet: Pick<CodexExecutionPacket, 'promptTemplate'>;
  history: BuildEvidenceHistoryEvent[];
}): BuildEvidenceProjection {
  const artifactVerificationSummaries = verifyArtifactsForBuildEvidence({
    buildEvidenceBundleId: input.bundle.buildEvidenceBundleId,
    run: input.run,
    expectedArtifactHashes: toExpectedArtifactHashMap(input.bundle),
  });

  const promptAttestationSummary = attestBuildEvidencePrompt({
    bundle: input.bundle,
    packet: input.packet,
    expectedPromptHash: input.bundle.promptHash,
  });

  const executionPlanAttestationSummary = attestBuildEvidenceExecutionPlan({
    bundle: input.bundle,
    run: input.run,
    expectedExecutionPlanHash: input.bundle.executionPlanHash,
  });

  const governance = deriveGovernanceValidationPosture({
    artifactVerifications: artifactVerificationSummaries,
    promptAttestation: promptAttestationSummary,
    executionPlanAttestation: executionPlanAttestationSummary,
  });

  return {
    buildEvidenceBundleId: input.bundle.buildEvidenceBundleId,
    runId: input.bundle.runId,
    packetId: input.bundle.packetId,
    bundleId: input.bundle.bundleId,
    artifactVerificationSummaries,
    promptAttestationSummary,
    executionPlanAttestationSummary,
    governanceValidation: governance.governanceValidation,
    verificationStatus: governance.verificationStatus,
    outcome: deriveBuildEvidenceOutcome(governance.governanceValidation),
    evidenceHistory: [...input.history].sort((left, right) => {
      const byType = left.eventType.localeCompare(right.eventType);
      if (byType !== 0) {
        return byType;
      }
      return left.payloadHash.localeCompare(right.payloadHash);
    }),
  };
}

export function deriveBuildEvidenceProjectionEvents(input: {
  projection: BuildEvidenceProjection;
}): BuildEvidenceHistoryEvent[] {
  const payloads = [
    {
      eventType: 'artifact_verification_recorded' as const,
      payload: { artifactVerificationIds: input.projection.artifactVerificationSummaries.map((entry) => entry.artifactVerificationId) },
    },
    {
      eventType: 'prompt_attestation_recorded' as const,
      payload: { promptAttestationId: input.projection.promptAttestationSummary.promptAttestationId },
    },
    {
      eventType: 'execution_plan_attestation_recorded' as const,
      payload: { executionPlanAttestationId: input.projection.executionPlanAttestationSummary.executionPlanAttestationId },
    },
    {
      eventType: 'build_evidence_governance_validated' as const,
      payload: {
        governanceValidation: input.projection.governanceValidation,
        verificationStatus: input.projection.verificationStatus,
        outcome: input.projection.outcome,
      },
    },
  ];

  return payloads.map((entry) => ({
    buildEvidenceBundleId: input.projection.buildEvidenceBundleId,
    runId: input.projection.runId,
    eventType: entry.eventType,
    payloadHash: toPayloadHash(entry.payload),
    payload: JSON.parse(canonicalStringify(entry.payload)) as Record<string, unknown>,
  }));
}
