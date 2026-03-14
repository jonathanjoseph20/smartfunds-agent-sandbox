import { canonicalStringify, sha256 } from '../finance/determinism.ts';

export type CodexExecutionPacketIdentityPayload = {
  graphId: string;
  taskId: string;
  promptTemplate: string;
  expectedArtifacts: string[];
  validationRules: string[];
  dependencies: string[];
  subsystem: string;
  phase: string;
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function normalizeCodexExecutionPacketIdentityPayload(
  payload: CodexExecutionPacketIdentityPayload,
): CodexExecutionPacketIdentityPayload {
  return {
    graphId: payload.graphId,
    taskId: payload.taskId,
    promptTemplate: payload.promptTemplate,
    expectedArtifacts: uniqueSorted(payload.expectedArtifacts),
    validationRules: uniqueSorted(payload.validationRules),
    dependencies: uniqueSorted(payload.dependencies),
    subsystem: payload.subsystem,
    phase: payload.phase,
  };
}

export function deriveCodexExecutionPacketId(payload: CodexExecutionPacketIdentityPayload): string {
  const normalizedPayload = normalizeCodexExecutionPacketIdentityPayload(payload);
  return sha256(canonicalStringify(normalizedPayload));
}
