import { describe, expect, it } from 'vitest';

import {
  computeTeamHistoryEventDedupeKey,
  createTeamHistoryStore,
} from '../../teams/team-history-store.ts';
import type { TeamDefinition } from '../../teams/team-definition-types.ts';

function buildDefinition(overrides: Partial<TeamDefinition> = {}): TeamDefinition {
  return {
    teamId: 'devops-team',
    displayName: 'DevOps Team',
    description: 'desc',
    teamType: 'devops',
    purpose: 'ops',
    domainTags: ['ops'],
    supportedMissionTypes: ['analyze-agent-economy-development'],
    supportedTemplateIds: ['analyze-agent-economy-development'],
    capabilityTags: ['operational_monitoring'],
    defaultOperatingMode: 'continuous',
    lifecycleState: 'active',
    availabilityState: 'manual_only',
    readinessState: 'partial',
    rosterPolicy: {
      type: 'placeholder',
      minAgents: 1,
      maxAgents: 4,
      requiredCapabilities: ['operational_monitoring'],
    },
    notes: ['note'],
    ...overrides,
  };
}

describe('team history store', () => {
  it('T-TH1 append-only projection and dedupe are deterministic', () => {
    const store = createTeamHistoryStore();
    const history = store.load(buildDefinition());
    const second = store.load(buildDefinition());

    expect(history.entries.length).toBeGreaterThan(0);
    expect(second).toEqual(history);
    expect(new Set(history.entries.map((entry) => entry.eventDedupeKey)).size).toBe(history.entries.length);
  });

  it('T-TH2 keeps stable event ordering', () => {
    const store = createTeamHistoryStore();
    const history = store.load(buildDefinition({ lifecycleState: 'archived' }));
    const sequences = history.entries.map((entry) => entry.sequence);

    expect([...sequences].sort((left, right) => left - right)).toEqual(sequences);
  });

  it('T-TH3 dedupe key generation is deterministic', () => {
    const input = {
      teamId: 'devops-team',
      eventType: 'team_defined' as const,
      payload: { lifecycleState: 'active' },
      reasoning: 'team_definition_loaded',
      sequence: 1,
    };

    expect(computeTeamHistoryEventDedupeKey(input)).toBe(computeTeamHistoryEventDedupeKey(input));
  });
});
