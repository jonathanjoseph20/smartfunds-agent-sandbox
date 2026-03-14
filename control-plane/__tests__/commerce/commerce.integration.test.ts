import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCommerceInspection } from '../../commerce/commerce-inspection.ts';

import { cleanupTmpRoot, createUpstreamFixture } from './test-helpers.ts';

const tmpRoot = path.join('control-plane', 'tests', 'commerce', 'tmp-commerce-integration');

afterEach(() => {
  cleanupTmpRoot(tmpRoot);
});

describe('commerce integration', () => {
  it('T-PF8-INT1 full pipeline through commerce is deterministic and read-only upstream', () => {
    const fixture = createUpstreamFixture(tmpRoot);

    const upstreamBefore = {
      runs: fs.readFileSync(fixture.paths.runsFilePath, 'utf8'),
      evidence: fs.readFileSync(fixture.paths.evidenceBundlesFilePath, 'utf8'),
    };

    const inspection = createCommerceInspection({
      commerceFilePath: path.join(tmpRoot, 'state', 'commerce.json'),
      historyFilePath: path.join(tmpRoot, 'state', 'commerce-history.json'),
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'commerce'),
      ...fixture.paths,
    });

    const first = inspection.createIntent({
      buildEvidenceBundleId: fixture.ids.buildEvidenceBundleId,
      monetizationClass: 'artifact_delivery',
      railClasses: ['stripe', 'erebor', 'evm_wallet'],
    });

    const second = inspection.createIntent({
      buildEvidenceBundleId: fixture.ids.buildEvidenceBundleId,
      monetizationClass: 'artifact_delivery',
      railClasses: ['evm_wallet', 'stripe', 'erebor'],
    });

    expect(first.chargeIntentId).toBe(second.chargeIntentId);

    const projection = inspection.inspectChargeIntent(first.chargeIntentId);
    expect(projection.railBindingSummaries.map((entry) => entry.railClass)).toEqual(['erebor', 'evm_wallet', 'stripe']);

    const primaryBindingId = projection.railBindingSummaries[0]!.railBindingId;
    const receipt = inspection.recordReceipt({
      chargeIntentId: first.chargeIntentId,
      railBindingId: primaryBindingId,
      receiptClass: 'payment_received',
      receiptReference: 'receipt-manual-1',
      reasonTokens: ['manual_confirmation'],
    });

    expect(receipt.paymentReceiptId.length).toBeGreaterThan(8);

    const finalized = inspection.inspectChargeIntent(first.chargeIntentId);
    expect(['fulfilled', 'pending', 'blocked', 'failed', 'inconclusive']).toContain(finalized.status);

    const upstreamAfter = {
      runs: fs.readFileSync(fixture.paths.runsFilePath, 'utf8'),
      evidence: fs.readFileSync(fixture.paths.evidenceBundlesFilePath, 'utf8'),
    };

    expect(upstreamAfter.runs).toBe(upstreamBefore.runs);
    expect(upstreamAfter.evidence).toBe(upstreamBefore.evidence);
  });
});
