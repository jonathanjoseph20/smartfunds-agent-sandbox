import { canonicalStringify, sha256 } from '../finance/determinism.ts';

export function deriveMissionRunId(input: {
  missionId: string;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
}): string {
  return sha256(canonicalStringify({
    missionId: input.missionId,
    executionAttemptId: input.executionAttemptId,
    runtimeEnvelopeId: input.runtimeEnvelopeId,
    executionContractId: input.executionContractId,
  }));
}
