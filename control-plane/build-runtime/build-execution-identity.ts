import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type { ArtifactType, ExecutionPlan } from './build-execution-types.ts';

export type BuildExecutionIdentityPayload = {
  packetId: string;
  bundleId: string;
  executionPlan: ExecutionPlan;
  repoTarget: string;
};

function normalizeString(value: string): string {
  return value.trim().replace(/\\/g, '/');
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizeExecutionPlan(executionPlan: ExecutionPlan): ExecutionPlan {
  const steps = executionPlan.steps
    .map((step) => ({
      stepId: normalizeString(step.stepId),
      operationType: step.operationType,
      targetPath: normalizeString(step.targetPath),
      promptTemplate: step.promptTemplate,
      expectedArtifacts: uniqueSorted(step.expectedArtifacts),
    }))
    .sort((left, right) => left.stepId.localeCompare(right.stepId));

  return { steps };
}

export function normalizeBuildExecutionIdentityPayload(
  payload: BuildExecutionIdentityPayload,
): BuildExecutionIdentityPayload {
  return {
    packetId: normalizeString(payload.packetId),
    bundleId: normalizeString(payload.bundleId),
    executionPlan: normalizeExecutionPlan(payload.executionPlan),
    repoTarget: normalizeString(payload.repoTarget),
  };
}

export function deriveBuildExecutionRunId(payload: BuildExecutionIdentityPayload): string {
  const normalized = normalizeBuildExecutionIdentityPayload(payload);
  return sha256(canonicalStringify(normalized));
}

export function deriveGeneratedArtifactId(input: {
  artifactType: ArtifactType;
  filePath: string;
  contentHash: string;
}): string {
  return sha256(canonicalStringify({
    artifactType: input.artifactType,
    filePath: normalizeString(input.filePath),
    contentHash: normalizeString(input.contentHash),
  }));
}
