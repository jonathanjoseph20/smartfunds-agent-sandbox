import { describe, expect, it } from 'vitest';

import { deriveVentureIdFromDefinition } from '../../ventures/venture-identity.ts';
import type { VentureDefinition } from '../../ventures/venture-types.ts';

function baseDefinition(overrides: Partial<VentureDefinition> = {}): VentureDefinition {
  return {
    ventureName: 'SmartFunds Core',
    ventureSlug: 'smartfunds-core',
    ventureClass: 'core_venture',
    ventureLifecycleState: 'defined',
    ownershipModel: 'internal',
    operatingMode: 'manual',
    originMissionIds: ['mission-a'],
    linkedMissionPortfolioIds: [],
    linkedTeamIds: ['operations-team'],
    linkedEntityIds: ['core-entity'],
    summary: 'summary',
    domainTags: ['issuance', 'transfer-agent'],
    productTypeTags: ['control-plane'],
    jurisdictionTags: ['us'],
    limitations: [],
    blockingReasons: [],
    provenanceInputs: {
      source: 'seed',
      referenceIds: ['sprint-9.1'],
    },
    ...overrides,
  };
}

describe('venture identity', () => {
  it('T-VI1 same semantic input -> same ID', () => {
    const first = deriveVentureIdFromDefinition(baseDefinition());
    const second = deriveVentureIdFromDefinition(baseDefinition());

    expect(first).toBe(second);
  });

  it('T-VI2 changed semantic input -> new ID', () => {
    const first = deriveVentureIdFromDefinition(baseDefinition());
    const second = deriveVentureIdFromDefinition(baseDefinition({ ventureClass: 'experimental_venture' }));

    expect(first).not.toBe(second);
  });

  it('T-VI3 non-semantic fields excluded from identity', () => {
    const first = deriveVentureIdFromDefinition(baseDefinition({ ventureName: 'Name A', summary: 'summary one' }));
    const second = deriveVentureIdFromDefinition(baseDefinition({ ventureName: 'Name B', summary: 'summary two' }));

    expect(first).toBe(second);
  });

  it('T-VI4 identity array normalization is deterministic', () => {
    const first = deriveVentureIdFromDefinition(baseDefinition({
      originMissionIds: ['mission-b', 'mission-a', 'mission-a'],
      domainTags: ['transfer-agent', 'issuance', 'issuance'],
      productTypeTags: ['control-plane', 'control-plane'],
      linkedEntityIds: ['core-entity', 'core-entity'],
    }));

    const second = deriveVentureIdFromDefinition(baseDefinition({
      originMissionIds: ['mission-a', 'mission-b'],
      domainTags: ['issuance', 'transfer-agent'],
      productTypeTags: ['control-plane'],
      linkedEntityIds: ['core-entity'],
    }));

    expect(first).toBe(second);
  });
});
