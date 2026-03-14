import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  ArtifactVerification,
  BuildEvidenceBundle,
  ExecutionPlanAttestation,
  PromptAttestation,
} from './build-evidence-types.ts';

function normalizeString(value: string): string {
  return value.trim().replace(/\\/g, '/');
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function normalizeBuildEvidenceBundleIdentityPayload(payload: {
  runId: string;
  packetId: string;
  bundleId: string;
  promptHash: string;
  executionPlanHash: string;
  artifactHashes: Array<{
    artifactId: string;
    artifactClass: string;
    filePath: string;
    contentHash: string;
  }>;
}) {
  return {
    runId: normalizeString(payload.runId),
    packetId: normalizeString(payload.packetId),
    bundleId: normalizeString(payload.bundleId),
    promptHash: normalizeString(payload.promptHash),
    executionPlanHash: normalizeString(payload.executionPlanHash),
    artifactHashes: [...payload.artifactHashes]
      .map((artifact) => ({
        artifactId: normalizeString(artifact.artifactId),
        artifactClass: normalizeString(artifact.artifactClass),
        filePath: normalizeString(artifact.filePath),
        contentHash: normalizeString(artifact.contentHash),
      }))
      .sort((left, right) => {
        const byId = left.artifactId.localeCompare(right.artifactId);
        if (byId !== 0) {
          return byId;
        }
        const byPath = left.filePath.localeCompare(right.filePath);
        if (byPath !== 0) {
          return byPath;
        }
        return left.contentHash.localeCompare(right.contentHash);
      }),
  };
}

export function deriveBuildEvidenceBundleId(payload: {
  runId: string;
  packetId: string;
  bundleId: string;
  promptHash: string;
  executionPlanHash: string;
  artifactHashes: Array<{
    artifactId: string;
    artifactClass: string;
    filePath: string;
    contentHash: string;
  }>;
}): string {
  return sha256(canonicalStringify(normalizeBuildEvidenceBundleIdentityPayload(payload)));
}

export function deriveArtifactVerificationId(payload: {
  buildEvidenceBundleId: string;
  artifactId: string;
  artifactClass: string;
  verificationClass: string;
  reasonTokens: string[];
}): string {
  return sha256(canonicalStringify({
    buildEvidenceBundleId: normalizeString(payload.buildEvidenceBundleId),
    artifactId: normalizeString(payload.artifactId),
    artifactClass: normalizeString(payload.artifactClass),
    verificationClass: normalizeString(payload.verificationClass),
    reasonTokens: uniqueSorted(payload.reasonTokens.map((entry) => normalizeString(entry))),
  }));
}

export function derivePromptAttestationId(payload: {
  buildEvidenceBundleId: string;
  packetId: string;
  promptHash: string;
  attestationClass: string;
  reasonTokens: string[];
}): string {
  return sha256(canonicalStringify({
    buildEvidenceBundleId: normalizeString(payload.buildEvidenceBundleId),
    packetId: normalizeString(payload.packetId),
    promptHash: normalizeString(payload.promptHash),
    attestationClass: normalizeString(payload.attestationClass),
    reasonTokens: uniqueSorted(payload.reasonTokens.map((entry) => normalizeString(entry))),
  }));
}

export function deriveExecutionPlanAttestationId(payload: {
  buildEvidenceBundleId: string;
  runId: string;
  executionPlanHash: string;
  attestationClass: string;
  reasonTokens: string[];
}): string {
  return sha256(canonicalStringify({
    buildEvidenceBundleId: normalizeString(payload.buildEvidenceBundleId),
    runId: normalizeString(payload.runId),
    executionPlanHash: normalizeString(payload.executionPlanHash),
    attestationClass: normalizeString(payload.attestationClass),
    reasonTokens: uniqueSorted(payload.reasonTokens.map((entry) => normalizeString(entry))),
  }));
}

export function computeBuildEvidenceBundleSemanticHash(bundle: BuildEvidenceBundle): string {
  return sha256(canonicalStringify(normalizeBuildEvidenceBundleIdentityPayload({
    runId: bundle.runId,
    packetId: bundle.packetId,
    bundleId: bundle.bundleId,
    promptHash: bundle.promptHash,
    executionPlanHash: bundle.executionPlanHash,
    artifactHashes: bundle.artifactHashes,
  })));
}

export function computeArtifactVerificationSemanticHash(verification: ArtifactVerification): string {
  return sha256(canonicalStringify({
    buildEvidenceBundleId: verification.buildEvidenceBundleId,
    artifactId: verification.artifactId,
    artifactClass: verification.artifactClass,
    verificationClass: verification.verificationClass,
    reasonTokens: [...verification.reasonTokens].sort((left, right) => left.localeCompare(right)),
    state: verification.state,
  }));
}

export function computePromptAttestationSemanticHash(attestation: PromptAttestation): string {
  return sha256(canonicalStringify({
    buildEvidenceBundleId: attestation.buildEvidenceBundleId,
    packetId: attestation.packetId,
    promptHash: attestation.promptHash,
    attestationClass: attestation.attestationClass,
    reasonTokens: [...attestation.reasonTokens].sort((left, right) => left.localeCompare(right)),
    state: attestation.state,
  }));
}

export function computeExecutionPlanAttestationSemanticHash(attestation: ExecutionPlanAttestation): string {
  return sha256(canonicalStringify({
    buildEvidenceBundleId: attestation.buildEvidenceBundleId,
    runId: attestation.runId,
    executionPlanHash: attestation.executionPlanHash,
    attestationClass: attestation.attestationClass,
    reasonTokens: [...attestation.reasonTokens].sort((left, right) => left.localeCompare(right)),
    state: attestation.state,
  }));
}
