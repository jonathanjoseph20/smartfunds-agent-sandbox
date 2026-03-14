import { describe, expect, it } from 'vitest';

import { deriveProductFactoryReleaseHardening } from '../../product-factory-release/product-factory-release-hardening.ts';
import type {
  ProductFactoryDocsCompleteness,
  ProductFactoryLifecycleAcceptance,
  ProductFactoryReplayValidation,
} from '../../product-factory-release/product-factory-release-acceptance-types.ts';

const lifecycle = (state: ProductFactoryLifecycleAcceptance['state']): ProductFactoryLifecycleAcceptance => ({
  productFactoryLifecycleAcceptanceId: 'l1',
  productFactoryReleaseAcceptanceRecordId: 'r1',
  coveredSubsystemIds: ['x'],
  acceptanceClass: state === 'accepted' ? 'lifecycle_complete' : 'lifecycle_inconclusive',
  reasonTokens: [],
  state,
});

const replay = (state: ProductFactoryReplayValidation['state']): ProductFactoryReplayValidation => ({
  productFactoryReplayValidationId: 'p1',
  productFactoryReleaseAcceptanceRecordId: 'r1',
  validatedSubsystemIds: ['x'],
  validationClass: state === 'accepted' ? 'replay_validated' : 'replay_inconclusive',
  reasonTokens: [],
  state,
});

const docs = (state: ProductFactoryDocsCompleteness['state']): ProductFactoryDocsCompleteness => ({
  productFactoryDocsCompletenessId: 'd1',
  productFactoryReleaseAcceptanceRecordId: 'r1',
  requiredDocumentIds: ['a'],
  presentDocumentIds: ['a'],
  completenessClass: state === 'accepted' ? 'docs_complete' : 'docs_inconclusive',
  reasonTokens: [],
  state,
});

describe('product factory release hardening', () => {
  it('T-PF9-H1 hardened', () => {
    const result = deriveProductFactoryReleaseHardening({
      productFactoryReleaseAcceptanceRecordId: 'r1',
      lifecycleAcceptance: lifecycle('accepted'),
      replayValidation: replay('accepted'),
      docsCompleteness: docs('accepted'),
      commerceState: 'accepted',
      releaseFailed: false,
    });

    expect(result.hardeningClass).toBe('hardened');
  });

  it('T-PF9-H2 partially_hardened', () => {
    const result = deriveProductFactoryReleaseHardening({
      productFactoryReleaseAcceptanceRecordId: 'r1',
      lifecycleAcceptance: lifecycle('accepted'),
      replayValidation: replay('partial'),
      docsCompleteness: docs('accepted'),
      commerceState: 'accepted',
      releaseFailed: false,
    });

    expect(result.hardeningClass).toBe('partially_hardened');
  });

  it('T-PF9-H3 blocked', () => {
    const result = deriveProductFactoryReleaseHardening({
      productFactoryReleaseAcceptanceRecordId: 'r1',
      lifecycleAcceptance: lifecycle('blocked'),
      replayValidation: replay('accepted'),
      docsCompleteness: docs('accepted'),
      commerceState: 'accepted',
      releaseFailed: false,
    });

    expect(result.hardeningClass).toBe('blocked');
  });

  it('T-PF9-H4 failed', () => {
    const result = deriveProductFactoryReleaseHardening({
      productFactoryReleaseAcceptanceRecordId: 'r1',
      lifecycleAcceptance: lifecycle('accepted'),
      replayValidation: replay('accepted'),
      docsCompleteness: docs('accepted'),
      commerceState: 'failed',
      releaseFailed: true,
    });

    expect(result.hardeningClass).toBe('failed');
  });
});
