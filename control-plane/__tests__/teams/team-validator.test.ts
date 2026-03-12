import { describe, expect, it } from 'vitest';

import {
  validateTeamRegistryDefinition,
  type TeamValidatorReferenceContext,
} from '../../teams/team-validator.ts';

function referenceContext(): TeamValidatorReferenceContext {
  return {
    knownMissionTypes: new Set(['produce-market-memo', 'evaluate-startup-opportunity', 'generate-product-spec']),
    knownTemplateIds: new Set(['produce-market-memo', 'evaluate-startup-opportunity', 'generate-product-spec']),
  };
}

function validDefinition(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    teamId: 'venture-opportunity-team',
    displayName: 'Venture Opportunity Team',
    description: 'desc',
    teamType: 'venture',
    purpose: 'Evaluate startup opportunities',
    domainTags: ['venture', 'startup'],
    supportedMissionTypes: ['produce-market-memo'],
    supportedTemplateIds: ['produce-market-memo'],
    capabilityTags: ['market_synthesis'],
    defaultOperatingMode: 'on_demand',
    lifecycleState: 'active',
    availabilityState: 'manual_only',
    readinessState: 'ready',
    rosterPolicy: {
      type: 'expandable',
      minAgents: 1,
      maxAgents: 3,
      requiredCapabilities: ['market_synthesis'],
    },
    notes: ['note'],
    ...overrides,
  };
}

describe('team validator', () => {
  it('T-TV1 rejects invalid team type', () => {
    const result = validateTeamRegistryDefinition(validDefinition({ teamType: 'unknown' }), referenceContext(), 'team.json');
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.field === 'teamType')).toBe(true);
  });

  it('T-TV2 rejects invalid operating mode', () => {
    const result = validateTeamRegistryDefinition(validDefinition({ defaultOperatingMode: 'always_on' }), referenceContext(), 'team.json');
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.field === 'defaultOperatingMode')).toBe(true);
  });

  it('T-TV3 rejects archived+available contradiction', () => {
    const result = validateTeamRegistryDefinition(
      validDefinition({ lifecycleState: 'archived', availabilityState: 'available' }),
      referenceContext(),
      'team.json',
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'archived_team_available')).toBe(true);
  });

  it('T-TV4 rejects invalid mission/template references', () => {
    const result = validateTeamRegistryDefinition(
      validDefinition({ supportedMissionTypes: ['missing-mission'], supportedTemplateIds: ['missing-template'] }),
      referenceContext(),
      'team.json',
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'invalid_mission_type_reference')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'invalid_template_reference')).toBe(true);
  });

  it('T-TV5 rejects missing and duplicate capability entries', () => {
    const missing = validateTeamRegistryDefinition(validDefinition({ capabilityTags: [] }), referenceContext(), 'team.json');
    const duplicate = validateTeamRegistryDefinition(validDefinition({ capabilityTags: ['market_synthesis', 'market_synthesis'] }), referenceContext(), 'team.json');

    expect(missing.issues.some((issue) => issue.code === 'missing_required_capabilities')).toBe(true);
    expect(duplicate.issues.some((issue) => issue.code === 'duplicate_entries')).toBe(true);
  });

  it('T-TV6 rejects roster min/max inconsistency', () => {
    const result = validateTeamRegistryDefinition(
      validDefinition({ rosterPolicy: { type: 'fixed', minAgents: 5, maxAgents: 1, requiredCapabilities: ['market_synthesis'] } }),
      referenceContext(),
      'team.json',
    );

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'invalid_bounds')).toBe(true);
  });
});
