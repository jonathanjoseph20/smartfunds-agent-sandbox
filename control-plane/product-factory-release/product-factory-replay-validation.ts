import { deriveProductFactoryReplayValidationId } from './product-factory-release-acceptance-identity.ts';
import type {
  ProductFactoryReplayValidation,
  ProductFactoryReleaseState,
} from './product-factory-release-acceptance-types.ts';

type ReplayCheckState = 'pass' | 'blocked' | 'failed' | 'inconclusive';

type ReplayCheck = {
  subsystemId: string;
  state: ReplayCheckState;
  reasonToken: string;
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter((entry) => entry.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

function toReplayState(validationClass: ProductFactoryReplayValidation['validationClass']): ProductFactoryReleaseState {
  if (validationClass === 'replay_validated') {
    return 'accepted';
  }
  if (validationClass === 'replay_partially_validated') {
    return 'partial';
  }
  if (validationClass === 'replay_blocked') {
    return 'blocked';
  }
  if (validationClass === 'replay_failed') {
    return 'failed';
  }
  return 'inconclusive';
}

export function deriveProductFactoryReplayValidation(input: {
  productFactoryReleaseAcceptanceRecordId: string;
  checks: ReplayCheck[];
}): ProductFactoryReplayValidation {
  const checks = [...input.checks].sort((left, right) => left.subsystemId.localeCompare(right.subsystemId));
  const validatedSubsystemIds = uniqueSorted(
    checks.filter((entry) => entry.state === 'pass').map((entry) => entry.subsystemId),
  );

  const reasonTokens = uniqueSorted(checks.map((entry) => entry.reasonToken));

  const states = checks.map((entry) => entry.state);
  let validationClass: ProductFactoryReplayValidation['validationClass'] = 'replay_inconclusive';

  if (states.includes('failed')) {
    validationClass = 'replay_failed';
  } else if (states.includes('blocked')) {
    validationClass = 'replay_blocked';
  } else if (states.length > 0 && states.every((entry) => entry === 'pass')) {
    validationClass = 'replay_validated';
  } else if (states.some((entry) => entry === 'pass')) {
    validationClass = 'replay_partially_validated';
  }

  const normalizedReasonTokens = uniqueSorted([
    ...reasonTokens,
    validationClass,
  ]);

  return {
    productFactoryReplayValidationId: deriveProductFactoryReplayValidationId({
      productFactoryReleaseAcceptanceRecordId: input.productFactoryReleaseAcceptanceRecordId,
      validatedSubsystemIds,
      validationClass,
      reasonTokens: normalizedReasonTokens,
    }),
    productFactoryReleaseAcceptanceRecordId: input.productFactoryReleaseAcceptanceRecordId,
    validatedSubsystemIds,
    validationClass,
    reasonTokens: normalizedReasonTokens,
    state: toReplayState(validationClass),
  };
}

export type { ReplayCheck, ReplayCheckState };
