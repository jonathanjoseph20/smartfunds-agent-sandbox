import { describe, expect, it } from 'vitest';

import { projectProductFactoryRelease } from '../../product-factory-release/product-factory-release-projection.ts';
import type {
  ProductFactoryReleaseAcceptanceRecord,
  ProductFactoryReleaseLayerSummary,
} from '../../product-factory-release/product-factory-release-acceptance-types.ts';

function buildAcceptedLayers(): ProductFactoryReleaseLayerSummary[] {
  return [
    'product_spec',
    'engineering_plan',
    'task_graph',
    'codex_packet',
    'repo_scaffold',
    'build_run',
    'build_evidence',
    'commerce_intent',
  ].map((layerClass, index) => ({
    layerId: `${layerClass}:${index}`,
    layerClass: layerClass as ProductFactoryReleaseLayerSummary['layerClass'],
    status: 'ready',
    state: 'accepted' as const,
    reasonTokens: [`${layerClass}:accepted`],
  }));
}

function buildRecord(): ProductFactoryReleaseAcceptanceRecord {
  return {
    productFactoryReleaseAcceptanceRecordId: 'release-1',
    releaseTrack: 'track-1',
    coveredLayerIds: ['a', 'b'],
    lifecycleAcceptanceId: 'l1',
    replayValidationId: 'r1',
    docsCompletenessId: 'd1',
    releaseHardeningId: 'h1',
    status: 'draft',
    outcome: 'not_ready',
  };
}

describe('product factory release projection', () => {
  it('T-PF9-PR1 deterministic projection replay', () => {
    const input = {
      acceptanceRecord: buildRecord(),
      coveredLayerSummaries: buildAcceptedLayers(),
      replayChecks: [{ subsystemId: 'x', state: 'pass' as const, reasonToken: 'ok' }],
      requiredDocumentIds: ['docs/a.md'],
      presentDocumentIds: ['docs/a.md'],
      releaseHistory: [],
    };

    const first = projectProductFactoryRelease(input);
    const second = projectProductFactoryRelease(input);

    expect(first).toEqual(second);
  });

  it('T-PF9-PR2 status and outcome derivation are deterministic', () => {
    const projection = projectProductFactoryRelease({
      acceptanceRecord: buildRecord(),
      coveredLayerSummaries: buildAcceptedLayers(),
      replayChecks: [{ subsystemId: 'x', state: 'pass', reasonToken: 'ok' }],
      requiredDocumentIds: ['docs/a.md'],
      presentDocumentIds: ['docs/a.md'],
      releaseHistory: [],
    });

    expect(projection.status).toBe('draft');
    expect(projection.outcome).toBe('not_ready');
  });

  it('T-PF9-PR3 blocked state is preferred over optimistic inference', () => {
    const layers = buildAcceptedLayers();
    layers[0] = {
      ...layers[0]!,
      status: 'blocked',
      state: 'blocked',
      reasonTokens: ['blocked'],
    };

    const projection = projectProductFactoryRelease({
      acceptanceRecord: buildRecord(),
      coveredLayerSummaries: layers,
      replayChecks: [{ subsystemId: 'x', state: 'pass', reasonToken: 'ok' }],
      requiredDocumentIds: ['docs/a.md'],
      presentDocumentIds: ['docs/a.md'],
      releaseHistory: [],
    });

    expect(projection.status).toBe('blocked');
    expect(projection.outcome).toBe('blocked');
  });
});
