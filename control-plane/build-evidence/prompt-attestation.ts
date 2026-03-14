import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import type { CodexExecutionPacket } from '../codex/codex-execution-packet-types.ts';

import { derivePromptAttestationId } from './build-evidence-identity.ts';
import type { BuildEvidenceBundle, PromptAttestation } from './build-evidence-types.ts';

function toState(attestationClass: PromptAttestation['attestationClass']): PromptAttestation['state'] {
  if (attestationClass === 'prompt_verified') {
    return 'verified';
  }
  if (attestationClass === 'prompt_mismatch') {
    return 'failed';
  }
  return 'inconclusive';
}

export function attestBuildEvidencePrompt(input: {
  bundle: Pick<BuildEvidenceBundle, 'buildEvidenceBundleId' | 'packetId' | 'promptHash'>;
  packet: Pick<CodexExecutionPacket, 'promptTemplate'>;
  expectedPromptHash?: string;
}): PromptAttestation {
  if (!input.packet.promptTemplate || input.packet.promptTemplate.trim().length === 0) {
    const attestationClass = 'prompt_missing' as const;
    const reasonTokens = ['prompt_missing'];

    return {
      promptAttestationId: derivePromptAttestationId({
        buildEvidenceBundleId: input.bundle.buildEvidenceBundleId,
        packetId: input.bundle.packetId,
        promptHash: input.bundle.promptHash,
        attestationClass,
        reasonTokens,
      }),
      buildEvidenceBundleId: input.bundle.buildEvidenceBundleId,
      packetId: input.bundle.packetId,
      promptHash: input.bundle.promptHash,
      attestationClass,
      reasonTokens,
      state: toState(attestationClass),
    };
  }

  const expectedHash = input.expectedPromptHash
    ?? sha256(canonicalStringify({ promptTemplate: input.packet.promptTemplate }));

  const attestationClass = expectedHash === input.bundle.promptHash
    ? 'prompt_verified' as const
    : 'prompt_mismatch' as const;

  const reasonTokens = attestationClass === 'prompt_verified'
    ? ['prompt_verified']
    : ['prompt_hash_mismatch'];

  return {
    promptAttestationId: derivePromptAttestationId({
      buildEvidenceBundleId: input.bundle.buildEvidenceBundleId,
      packetId: input.bundle.packetId,
      promptHash: input.bundle.promptHash,
      attestationClass,
      reasonTokens,
    }),
    buildEvidenceBundleId: input.bundle.buildEvidenceBundleId,
    packetId: input.bundle.packetId,
    promptHash: input.bundle.promptHash,
    attestationClass,
    reasonTokens,
    state: toState(attestationClass),
  };
}
