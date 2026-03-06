import { describe, expect, it } from 'vitest';

import { validateTeamDefinition } from './team-validator.ts';

function validTeam(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    teamId: 'smartfunds-research-team',
    name: 'SmartFunds Research Team',
    projectId: 'smartfunds-core',
    members: ['lead-thesis-architect', 'macro-signal-analyst', 'compliance-risk-reviewer'],
    executionMode: 'structured',
    ...overrides
  };
}

describe('team-validator', () => {
  it('T-T1 validates team with known agent profiles', () => {
    const team = validateTeamDefinition(validTeam(), new Set([
      'lead-thesis-architect',
      'macro-signal-analyst',
      'compliance-risk-reviewer'
    ]));

    expect(team.teamId).toBe('smartfunds-research-team');
    expect(team.members).toEqual([
      'compliance-risk-reviewer',
      'lead-thesis-architect',
      'macro-signal-analyst'
    ]);
  });

  it('T-T2 rejects duplicate members', () => {
    expect(() => validateTeamDefinition(validTeam({
      members: ['lead-thesis-architect', 'lead-thesis-architect']
    }))).toThrow(/duplicate members/);
  });

  it('T-T3 rejects unknown agent profile references', () => {
    expect(() => validateTeamDefinition(validTeam(), new Set(['lead-thesis-architect']))).toThrow(
      /references unknown agent profiles/
    );
  });
});
