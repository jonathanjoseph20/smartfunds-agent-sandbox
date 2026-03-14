import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCommerceInspection } from '../../commerce/commerce-inspection.ts';
import {
  PRODUCT_FACTORY_RELEASE_REQUIRED_DOCUMENT_IDS,
} from '../../product-factory-release/product-factory-release-acceptance-types.ts';
import { createProductFactoryReleaseInspection } from '../../product-factory-release/product-factory-release-inspection.ts';

import { cleanupTmpRoot, createUpstreamFixture } from '../commerce/test-helpers.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'product-factory-release', 'tmp-release-integration');

afterEach(() => {
  cleanupTmpRoot(tmpRoot);
});

describe('product factory release integration', () => {
  it('T-PF9-INT1 pipeline through release acceptance is deterministic, replay-safe, and closes append-only', () => {
    const fixture = createUpstreamFixture(tmpRoot);

    const commerceInspection = createCommerceInspection({
      commerceFilePath: path.join(tmpRoot, 'state', 'commerce.json'),
      historyFilePath: path.join(tmpRoot, 'state', 'commerce-history.json'),
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'commerce'),
      ...fixture.paths,
    });

    const createdIntent = commerceInspection.createIntent({
      buildEvidenceBundleId: fixture.ids.buildEvidenceBundleId,
      monetizationClass: 'artifact_delivery',
      railClasses: ['stripe'],
    });

    const upstreamBeforeRelease = {
      specs: fs.readFileSync(fixture.paths.specsFilePath, 'utf8'),
      plans: fs.readFileSync(fixture.paths.plansFilePath, 'utf8'),
      graphs: fs.readFileSync(fixture.paths.taskGraphsFilePath, 'utf8'),
      packets: fs.readFileSync(fixture.paths.packetsFilePath, 'utf8'),
      bundles: fs.readFileSync(fixture.paths.bundlesFilePath, 'utf8'),
      runs: fs.readFileSync(fixture.paths.runsFilePath, 'utf8'),
      evidence: fs.readFileSync(fixture.paths.evidenceBundlesFilePath, 'utf8'),
      commerce: fs.readFileSync(path.join(tmpRoot, 'state', 'commerce.json'), 'utf8'),
    };

    const inspection = createProductFactoryReleaseInspection({
      recordsFilePath: path.join(tmpRoot, 'state', 'release-records.json'),
      historyFilePath: path.join(tmpRoot, 'state', 'release-history.json'),
      releaseArtifactsRoot: path.join(tmpRoot, 'artifacts', 'product-factory-release'),
      commerceFilePath: path.join(tmpRoot, 'state', 'commerce.json'),
      commerceHistoryFilePath: path.join(tmpRoot, 'state', 'commerce-history.json'),
      ...fixture.paths,
    });

    const first = inspection.createReleaseAcceptance({
      releaseTrack: 'pf9-track',
      chargeIntentId: createdIntent.chargeIntentId,
      presentDocumentIds: [...PRODUCT_FACTORY_RELEASE_REQUIRED_DOCUMENT_IDS],
    });

    const second = inspection.createReleaseAcceptance({
      releaseTrack: 'pf9-track',
      chargeIntentId: createdIntent.chargeIntentId,
      presentDocumentIds: [...PRODUCT_FACTORY_RELEASE_REQUIRED_DOCUMENT_IDS],
    });

    expect(first.productFactoryReleaseAcceptanceRecordId).toBe(second.productFactoryReleaseAcceptanceRecordId);

    const validated = inspection.validateReleaseAcceptance({
      productFactoryReleaseAcceptanceRecordId: first.productFactoryReleaseAcceptanceRecordId,
      presentDocumentIds: [...PRODUCT_FACTORY_RELEASE_REQUIRED_DOCUMENT_IDS],
    });

    const inspectedOnce = inspection.inspectReleaseAcceptanceRecord(first.productFactoryReleaseAcceptanceRecordId);
    const inspectedTwice = inspection.inspectReleaseAcceptanceRecord(first.productFactoryReleaseAcceptanceRecordId);

    expect(inspectedOnce).toEqual(inspectedTwice);
    expect(validated.productFactoryReleaseAcceptanceRecordId).toBe(first.productFactoryReleaseAcceptanceRecordId);

    const materialized = inspection.materializeReleaseAcceptance({
      productFactoryReleaseAcceptanceRecordId: first.productFactoryReleaseAcceptanceRecordId,
    });

    expect(fs.existsSync(materialized.statusPath)).toBe(true);
    expect(fs.existsSync(materialized.lifecycleAcceptancePath)).toBe(true);
    expect(fs.existsSync(materialized.replayValidationPath)).toBe(true);
    expect(fs.existsSync(materialized.docsCompletenessPath)).toBe(true);
    expect(fs.existsSync(materialized.releaseHardeningPath)).toBe(true);
    expect(fs.existsSync(materialized.historyPath)).toBe(true);
    expect(fs.existsSync(materialized.outcomePath)).toBe(true);
    expect(fs.existsSync(materialized.reportJsonPath)).toBe(true);
    expect(fs.existsSync(materialized.reportMarkdownPath)).toBe(true);

    const closed = inspection.closeReleaseAcceptance({
      productFactoryReleaseAcceptanceRecordId: first.productFactoryReleaseAcceptanceRecordId,
    });

    expect(closed.status).toBe('closed');

    const history = inspection.inspectReleaseHistory(first.productFactoryReleaseAcceptanceRecordId);
    expect(history.some((entry) => entry.eventType === 'product_factory_release_closed')).toBe(true);

    const upstreamAfterRelease = {
      specs: fs.readFileSync(fixture.paths.specsFilePath, 'utf8'),
      plans: fs.readFileSync(fixture.paths.plansFilePath, 'utf8'),
      graphs: fs.readFileSync(fixture.paths.taskGraphsFilePath, 'utf8'),
      packets: fs.readFileSync(fixture.paths.packetsFilePath, 'utf8'),
      bundles: fs.readFileSync(fixture.paths.bundlesFilePath, 'utf8'),
      runs: fs.readFileSync(fixture.paths.runsFilePath, 'utf8'),
      evidence: fs.readFileSync(fixture.paths.evidenceBundlesFilePath, 'utf8'),
      commerce: fs.readFileSync(path.join(tmpRoot, 'state', 'commerce.json'), 'utf8'),
    };

    expect(upstreamAfterRelease).toEqual(upstreamBeforeRelease);
  });
});
