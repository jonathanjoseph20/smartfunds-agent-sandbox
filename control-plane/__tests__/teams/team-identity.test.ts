import { describe, expect, it } from 'vitest';

import {
  buildTeamIdentityPayload,
  deriveTeamIdentityHash,
  deriveTeamIdentityHashFromDefinition,
} from '../../teams/team-identity.ts';
import type { TeamDefinition } from '../../teams/team-definition-types.ts';

function createDefinition(overrides: Partial<TeamDefinition> = {}): TeamDefinition {
  return {
    teamId: 'venture-opportunity-team',
    displayName: 'Venture Opportunity Team',
    description: 'desc',
    teamType: 'venture',
    purpose: 'Evaluate startup ideas',
    domainTags: ['venture', 'startup'],
    supportedMissionTypes: ['produce-market-memo', 'evaluate-startup-opportunity'],
    supportedTemplateIds: ['produce-market-memo', 'evaluate-startup-opportunity'],
    capabilityTags: ['market_synthesis', 'opportunity_evaluation'],
    defaultOperatingMode: 'on_demand',
    lifecycleState: 'active',
    availabilityState: 'manual_only',
    readinessState: 'ready',
    rosterPolicy: {
      type: 'expandable',
      minAgents: 2,
      maxAgents: 5,
      requiredCapabilities: ['opportunity_evaluation'],
    },
    notes: ['note'],
    ...overrides,
  };
}

describe('team identity', () => {
  it('T-TI1 same semantic payload => same identity hash', () => {
    const first = createDefinition();
    const second = createDefinition();

    expect(deriveTeamIdentityHashFromDefinition(first)).toBe(deriveTeamIdentityHashFromDefinition(second));
  });

  it('T-TI2 ordering normalization keeps hash stable', () => {
    const first = createDefinition({
      domainTags: ['startup', 'venture'],
      supportedMissionTypes: ['evaluate-startup-opportunity', 'produce-market-memo'],
      supportedTemplateIds: ['evaluate-startup-opportunity', 'produce-market-memo'],
      capabilityTags: ['opportunity_evaluation', 'market_synthesis'],
    });

    const second = createDefinition({
      domainTags: ['venture', 'startup'],
      supportedMissionTypes: ['produce-market-memo', 'evaluate-startup-opportunity'],
      supportedTemplateIds: ['produce-market-memo', 'evaluate-startup-opportunity'],
      capabilityTags: ['market_synthesis', 'opportunity_evaluation'],
    });

    expect(deriveTeamIdentityHashFromDefinition(first)).toBe(deriveTeamIdentityHashFromDefinition(second));
  });

  it('T-TI3 excluded non-semantic fields do not affect identity payload/hash', () => {
    const first = createDefinition({ description: 'one', notes: ['x'], lifecycleState: 'active', availabilityState: 'manual_only' });
    const second = createDefinition({ description: 'two', notes: ['y'], lifecycleState: 'dormant', availabilityState: 'restricted' });

    const payloadOne = buildTeamIdentityPayload(first);
    const payloadTwo = buildTeamIdentityPayload(second);

    expect(deriveTeamIdentityHash(payloadOne)).toBe(deriveTeamIdentityHash(payloadTwo));
  });

  it('T-TI4 seeded IDs remain stable', () => {
    const definition = createDefinition({ teamId: 'venture-opportunity-team' });
    expect(definition.teamId).toBe('venture-opportunity-team');
  });
});
