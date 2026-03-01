import { canonicalStringify, sha256 } from '../finance/determinism.ts';

export type ExecutionEnvelope = {
  runInput: unknown;
  resolvedTeam: string;
  executionMode: 'structured' | 'autonomous' | string;
  impliedTier: number;
  declaredTier: number;
  normalizedFailureSignature: string | null;
};

export const ENVELOPE_ERROR_CODES = {
  ENVELOPE_HASH_MISMATCH: 'ERR_ENVELOPE_HASH_MISMATCH'
} as const;

export class EnvelopeMismatchError extends Error {
  public readonly code = ENVELOPE_ERROR_CODES.ENVELOPE_HASH_MISMATCH;

  constructor(expectedEnvelopeHash: string, receivedEnvelopeHash: string) {
    super(`Envelope hash mismatch: expected=${expectedEnvelopeHash} received=${receivedEnvelopeHash}`);
    this.name = 'EnvelopeMismatchError';
  }
}

export function buildExecutionEnvelope(input: {
  runInput: unknown;
  resolvedTeam: string;
  executionMode: 'structured' | 'autonomous' | string;
  impliedTier: number;
  declaredTier: number;
  normalizedFailureSignature?: string | null;
}): ExecutionEnvelope {
  return {
    runInput: input.runInput,
    resolvedTeam: input.resolvedTeam,
    executionMode: input.executionMode,
    impliedTier: input.impliedTier,
    declaredTier: input.declaredTier,
    normalizedFailureSignature: input.normalizedFailureSignature ?? null
  };
}

export function computeEnvelopeHash(envelope: ExecutionEnvelope): string {
  return sha256(canonicalStringify(envelope));
}

export function assertEnvelopeHashMatch(expectedEnvelopeHash: string, receivedEnvelopeHash: string): void {
  if (expectedEnvelopeHash !== receivedEnvelopeHash) {
    throw new EnvelopeMismatchError(expectedEnvelopeHash, receivedEnvelopeHash);
  }
}
