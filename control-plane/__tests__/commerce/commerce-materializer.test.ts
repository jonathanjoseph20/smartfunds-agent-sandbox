import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCommerceInspection } from '../../commerce/commerce-inspection.ts';

import { cleanupTmpRoot, createUpstreamFixture } from './test-helpers.ts';

const tmpRoot = path.join('control-plane', 'tests', 'commerce', 'tmp-commerce-materializer');

afterEach(() => {
  cleanupTmpRoot(tmpRoot);
});

describe('commerce materializer', () => {
  it('T-PF8-M1 artifact materialization stability', () => {
    const fixture = createUpstreamFixture(tmpRoot);
    const inspection = createCommerceInspection({
      commerceFilePath: path.join(tmpRoot, 'state', 'commerce.json'),
      historyFilePath: path.join(tmpRoot, 'state', 'commerce-history.json'),
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'commerce'),
      ...fixture.paths,
    });

    const created = inspection.createIntent({
      buildEvidenceBundleId: fixture.ids.buildEvidenceBundleId,
    });

    const first = inspection.materializeCommerce(created.chargeIntentId);
    const second = inspection.materializeCommerce(created.chargeIntentId);

    expect(fs.readFileSync(first.statusPath, 'utf8')).toBe(fs.readFileSync(second.statusPath, 'utf8'));
    expect(fs.existsSync(first.railBindingsPath)).toBe(true);
    expect(fs.existsSync(first.railEligibilityPath)).toBe(true);
    expect(fs.existsSync(first.paymentReceiptsPath)).toBe(true);
    expect(fs.existsSync(first.settlementLogPath)).toBe(true);
    expect(fs.existsSync(first.historyPath)).toBe(true);
    expect(fs.existsSync(first.outcomePath)).toBe(true);
    expect(fs.existsSync(first.reportJsonPath)).toBe(true);
    expect(fs.existsSync(first.reportMarkdownPath)).toBe(true);
  });
});
