import { describe, expect, it } from 'vitest';

import {
  validateVentureDefinition,
  type VentureValidatorReferenceContext,
} from '../../ventures/venture-validator.ts';

function context(): VentureValidatorReferenceContext {
  return {
    knownMissionIds: new Set(['mission-a']),
    knownTeamIds: new Set(['operations-team']),
    knownEntityIds: new Set(['core-entity']),
  };
}

function validDefinition(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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

describe('venture validator', () => {
  it('T-VV1 invalid enums are rejected', () => {
    const result = validateVentureDefinition(validDefinition({ ventureClass: 'unknown' }), context());
    expect(result.findings.some((finding) => finding.field === 'ventureClass' && finding.code === 'invalid_enum')).toBe(true);
  });

  it('T-VV2 duplicate tags are normalized/deduped', () => {
    const result = validateVentureDefinition(validDefinition({ domainTags: ['issuance', 'issuance', 'transfer-agent'] }), context());
    expect(result.normalized.domainTags).toEqual(['issuance', 'transfer-agent']);
  });

  it('T-VV3 missing provenance surfaces are detected', () => {
    const result = validateVentureDefinition(validDefinition({ provenanceInputs: { source: '', referenceIds: [] } }), context());
    expect(result.findings.some((finding) => finding.code === 'provenance_missing_source')).toBe(true);
    expect(result.findings.some((finding) => finding.code === 'provenance_missing_reference_ids')).toBe(true);
  });

  it('T-VV4 invalid mission/team references are surfaced', () => {
    const result = validateVentureDefinition(
      validDefinition({ originMissionIds: ['missing-mission'], linkedTeamIds: ['missing-team'] }),
      context(),
    );

    expect(result.findings.some((finding) => finding.code === 'invalid_mission_reference')).toBe(true);
    expect(result.findings.some((finding) => finding.code === 'invalid_team_reference')).toBe(true);
  });

  it('T-VV5 illegal class/operatingMode combinations are surfaced', () => {
    const result = validateVentureDefinition(
      validDefinition({ ventureClass: 'internal_tooling_venture', operatingMode: 'autonomous' }),
      context(),
    );

    expect(result.findings.some((finding) => finding.code === 'invalid_operating_mode_for_class')).toBe(true);
  });
});
