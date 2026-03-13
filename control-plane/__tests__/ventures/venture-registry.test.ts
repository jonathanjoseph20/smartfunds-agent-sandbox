import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { deriveVentureIdFromDefinition } from '../../ventures/venture-identity.ts';
import { createVentureRegistry, loadVentures } from '../../ventures/venture-registry.ts';
import type { VentureDefinition } from '../../ventures/venture-types.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-venture-registry');

function writeJson(fileName: string, value: unknown): void {
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.writeFileSync(path.join(tmpRoot, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function definition(slug: string, overrides: Partial<VentureDefinition> = {}): VentureDefinition {
  return {
    ventureName: slug,
    ventureSlug: slug,
    ventureClass: 'core_venture',
    ventureLifecycleState: 'defined',
    ownershipModel: 'internal',
    operatingMode: 'manual',
    originMissionIds: ['mission-a'],
    linkedMissionPortfolioIds: [],
    linkedTeamIds: [],
    linkedEntityIds: [],
    summary: 'summary',
    domainTags: ['issuance'],
    productTypeTags: ['control-plane'],
    jurisdictionTags: ['us'],
    limitations: [],
    blockingReasons: [],
    provenanceInputs: {
      source: 'seed',
      referenceIds: ['ref-1'],
    },
    ...overrides,
  };
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('venture registry', () => {
  it('T-VR1 deterministic ordering by semantic key then ID', () => {
    writeJson('zeta.json', definition('zeta-venture'));
    writeJson('alpha.json', definition('alpha-venture'));

    const loaded = loadVentures({
      definitionsDir: tmpRoot,
      referenceContext: { knownMissionIds: new Set(['mission-a']), knownTeamIds: new Set(), knownEntityIds: new Set() },
    });

    expect(loaded.map((entry) => entry.definition.ventureSlug)).toEqual(['alpha-venture', 'zeta-venture']);
  });

  it('T-VR2 duplicate IDs are rejected', () => {
    const first = definition('venture-a');
    const second = definition('venture-b', {
      ventureSlug: 'venture-b',
      ventureClass: first.ventureClass,
      ownershipModel: first.ownershipModel,
      originMissionIds: first.originMissionIds,
      domainTags: first.domainTags,
      productTypeTags: first.productTypeTags,
      linkedEntityIds: first.linkedEntityIds,
    });

    const duplicateId = deriveVentureIdFromDefinition(first);
    writeJson('a.json', { ...first, ventureId: duplicateId });
    writeJson('b.json', { ...second, ventureId: duplicateId });

    expect(() => loadVentures({
      definitionsDir: tmpRoot,
      referenceContext: { knownMissionIds: new Set(['mission-a']), knownTeamIds: new Set(), knownEntityIds: new Set() },
    })).toThrow('INVALID_VENTURE_DEFINITION');
  });

  it('T-VR3 empty registry handling', () => {
    fs.mkdirSync(tmpRoot, { recursive: true });
    expect(() => loadVentures({ definitionsDir: tmpRoot })).toThrow('VENTURE_REGISTRY_EMPTY');
  });

  it('T-VR4 provided ventureId must match deterministic identity', () => {
    writeJson('invalid.json', { ...definition('invalid-id-venture'), ventureId: 'not-matching' });

    expect(() => loadVentures({
      definitionsDir: tmpRoot,
      referenceContext: { knownMissionIds: new Set(['mission-a']), knownTeamIds: new Set(), knownEntityIds: new Set() },
    })).toThrow('INVALID_VENTURE_DEFINITION');
  });

  it('T-VR5 getVenture throws VENTURE_NOT_FOUND', () => {
    writeJson('alpha.json', definition('alpha-venture'));

    const registry = createVentureRegistry({
      definitionsDir: tmpRoot,
      referenceContext: { knownMissionIds: new Set(['mission-a']), knownTeamIds: new Set(), knownEntityIds: new Set() },
    });

    expect(() => registry.getVenture('missing')).toThrow('VENTURE_NOT_FOUND');
  });
});
