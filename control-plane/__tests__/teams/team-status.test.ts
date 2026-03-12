import { describe, expect, it } from 'vitest';

import type { TeamDefinition } from '../../teams/team-definition-types.ts';
import { evaluateTeamStatus } from '../../teams/team-status.ts';

function validDefinition(overrides: Partial<TeamDefinition> = {}): TeamDefinition {
  return {
    teamId: 'engineering-team',
    displayName: 'Engineering Team',
    description: 'desc',
    teamType: 'engineering',
    purpose: 'Build architecture readiness',
    domainTags: ['architecture'],
    supportedMissionTypes: ['generate-product-spec'],
    supportedTemplateIds: ['generate-product-spec'],
    capabilityTags: ['architecture_design'],
    defaultOperatingMode: 'on_demand',
    lifecycleState: 'active',
    availabilityState: 'restricted',
    readinessState: 'ready',
    rosterPolicy: {
      type: 'expandable',
      minAgents: 1,
      maxAgents: 5,
      requiredCapabilities: ['architecture_design'],
    },
    notes: ['note'],
    ...overrides,
  };
}

describe('team status', () => {
  it('T-TS1 active + valid => ready', () => {
    const status = evaluateTeamStatus({ definition: validDefinition(), validationIssues: [] });
    expect(status.readinessState).toBe('ready');
  });

  it('T-TS2 dormant reserve can be partial without being blocked', () => {
    const status = evaluateTeamStatus({
      definition: validDefinition({
        lifecycleState: 'dormant',
        defaultOperatingMode: 'dormant_reserve',
        rosterPolicy: { type: 'placeholder', minAgents: 0, maxAgents: 3, requiredCapabilities: ['architecture_design'] },
      }),
      validationIssues: [],
    });

    expect(status.readinessState).toBe('partial');
    expect(status.blockingReasons).toEqual([]);
  });

  it('T-TS3 archived+available contradiction => blocked', () => {
    const status = evaluateTeamStatus({
      definition: validDefinition({ lifecycleState: 'archived', availabilityState: 'available' }),
      validationIssues: [{ teamId: 'engineering-team', field: 'availabilityState', code: 'archived_team_available', message: 'x' }],
    });

    expect(status.readinessState).toBe('blocked');
  });

  it('T-TS4 placeholder roster metadata => partial', () => {
    const status = evaluateTeamStatus({
      definition: validDefinition({
        rosterPolicy: { type: 'placeholder', minAgents: 0, maxAgents: 5, requiredCapabilities: ['architecture_design'] },
      }),
      validationIssues: [],
    });

    expect(status.readinessState).toBe('partial');
  });

  it('T-TS5 invalid references => blocked', () => {
    const status = evaluateTeamStatus({
      definition: validDefinition(),
      validationIssues: [{ teamId: 'engineering-team', field: 'supportedTemplateIds', code: 'invalid_template_reference', message: 'x' }],
    });

    expect(status.readinessState).toBe('blocked');
  });

  it('T-TS6 conflicting conditions => inconclusive', () => {
    const status = evaluateTeamStatus({
      definition: validDefinition({ lifecycleState: 'archived', availabilityState: 'available' }),
      validationIssues: [
        { teamId: 'engineering-team', field: 'availabilityState', code: 'archived_team_available', message: 'x' },
        { teamId: 'engineering-team', field: 'lifecycleState', code: 'invalid_enum', message: 'y' },
      ],
    });

    expect(status.readinessState).toBe('inconclusive');
  });
});
