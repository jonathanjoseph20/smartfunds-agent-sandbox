import { describe, expect, it } from 'vitest';

import { canonicalStringify, sha256 } from '../../finance/determinism.ts';
import { attestBuildEvidencePrompt } from '../../build-evidence/prompt-attestation.ts';

describe('prompt attestation', () => {
  it('T-PF7-P1 prompt_verified', () => {
    const promptHash = sha256(canonicalStringify({ promptTemplate: 'prompt' }));
    const result = attestBuildEvidencePrompt({
      bundle: {
        buildEvidenceBundleId: 'be-1',
        packetId: 'packet-1',
        promptHash,
      },
      packet: {
        promptTemplate: 'prompt',
      },
      expectedPromptHash: promptHash,
    });

    expect(result.attestationClass).toBe('prompt_verified');
  });

  it('T-PF7-P2 prompt_mismatch', () => {
    const result = attestBuildEvidencePrompt({
      bundle: {
        buildEvidenceBundleId: 'be-1',
        packetId: 'packet-1',
        promptHash: 'different',
      },
      packet: {
        promptTemplate: 'prompt',
      },
      expectedPromptHash: sha256(canonicalStringify({ promptTemplate: 'prompt' })),
    });

    expect(result.attestationClass).toBe('prompt_mismatch');
  });

  it('T-PF7-P3 prompt_missing', () => {
    const result = attestBuildEvidencePrompt({
      bundle: {
        buildEvidenceBundleId: 'be-1',
        packetId: 'packet-1',
        promptHash: 'x',
      },
      packet: {
        promptTemplate: '',
      },
    });

    expect(result.attestationClass).toBe('prompt_missing');
  });

  it('T-PF7-P4 prompt_inconclusive uses missing state when prompt unavailable', () => {
    const result = attestBuildEvidencePrompt({
      bundle: {
        buildEvidenceBundleId: 'be-1',
        packetId: 'packet-1',
        promptHash: 'x',
      },
      packet: {
        promptTemplate: '   ',
      },
    });

    expect(result.state).toBe('inconclusive');
  });
});
