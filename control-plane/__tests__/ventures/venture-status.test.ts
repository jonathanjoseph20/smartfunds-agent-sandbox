import { describe, expect, it } from 'vitest';

import { deriveVentureStatus } from '../../ventures/venture-status.ts';
import type { VentureDefinition, VentureValidationResult } from '../../ventures/venture-types.ts';

function definition(overrides: Partial<VentureDefinition> = {}): VentureDefinition {
  return {
    ventureId: 'venture-1',
    ventureName: 'SmartFunds Core',
    ventureSlug: 'smartfunds-core',
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

function validation(findings: VentureValidationResult['findings']): VentureValidationResult {
  return {
    ventureId: 'venture-1',
    valid: findings.length === 0,
    outcome: findings.length === 0 ? 'satisfied' : 'blocked',
    findings,
    normalized: definition(),
  };
}

describe('venture status', () => {
  it('T-VS1 blocked findings => blocked status', () => {
    const status = deriveVentureStatus({
      definition: definition(),
      validation: validation([{ ventureId: 'venture-1', field: 'ownershipModel', code: 'ownership_contradiction', message: 'x' }]),
    });

    expect(status.ventureStatus).toBe('blocked');
  });

  it('T-VS2 incomplete findings => incomplete status', () => {
    const status = deriveVentureStatus({
      definition: definition(),
      validation: validation([{ ventureId: 'venture-1', field: 'originMissionIds', code: 'missing_origin_missions', message: 'x' }]),
    });

    expect(status.ventureStatus).toBe('incomplete');
  });

  it('T-VS3 inconclusive findings => inconclusive status', () => {
    const status = deriveVentureStatus({
      definition: definition(),
      validation: validation([{ ventureId: 'venture-1', field: 'ventureClass', code: 'classification_inconclusive', message: 'x' }]),
    });

    expect(status.ventureStatus).toBe('inconclusive');
  });

  it('T-VS4 lifecycle remains structural and unchanged by validation', () => {
    const status = deriveVentureStatus({
      definition: definition({ ventureLifecycleState: 'archived' }),
      validation: validation([{ ventureId: 'venture-1', field: 'domainTags', code: 'missing_domain_tags', message: 'x' }]),
    });

    expect(status.ventureLifecycleState).toBe('archived');
  });
});
