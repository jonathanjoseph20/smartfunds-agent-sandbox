import { describe, expect, it } from 'vitest';

import { validateTeamRegistry } from './schema';
import type { TeamDefinition } from './types';

describe('team registry schema', () => {
  it('rejects missing executionMode (T-M10)', () => {
    const teams = [
      {
        teamId: 'alpha',
        ownedPaths: ['apps/**']
      }
    ] as TeamDefinition[];

    expect(() => validateTeamRegistry(teams)).toThrow(/executionMode/);
  });

  it('rejects invalid executionMode (T-M11)', () => {
    const teams = [
      {
        teamId: 'alpha',
        executionMode: 'manual',
        ownedPaths: ['apps/**']
      }
    ] as unknown as TeamDefinition[];

    expect(() => validateTeamRegistry(teams)).toThrow(/executionMode/);
  });

  it('rejects duplicate teamId (T-M12)', () => {
    const teams: TeamDefinition[] = [
      {
        teamId: 'alpha',
        executionMode: 'structured',
        ownedPaths: ['apps/**']
      },
      {
        teamId: 'alpha',
        executionMode: 'autonomous',
        ownedPaths: ['docs/**']
      }
    ];

    expect(() => validateTeamRegistry(teams)).toThrow(/Duplicate teamId/);
  });

  it('rejects empty ownedPaths (T-M13)', () => {
    const teams: TeamDefinition[] = [
      {
        teamId: 'alpha',
        executionMode: 'structured',
        ownedPaths: []
      }
    ];

    expect(() => validateTeamRegistry(teams)).toThrow(/ownedPaths/);
  });

  it('sorts teams and ownedPaths deterministically (T-M14)', () => {
    const teams: TeamDefinition[] = [
      {
        teamId: 'beta',
        executionMode: 'structured',
        ownedPaths: ['z/**', 'a/**']
      },
      {
        teamId: 'alpha',
        executionMode: 'autonomous',
        ownedPaths: ['docs/**']
      }
    ];

    const result = validateTeamRegistry(teams);
    expect(result.map((team) => team.teamId)).toEqual(['alpha', 'beta']);
    expect(result[1].ownedPaths).toEqual(['a/**', 'z/**']);
  });
});
