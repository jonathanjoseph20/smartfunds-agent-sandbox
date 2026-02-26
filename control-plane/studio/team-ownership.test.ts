import { describe, expect, it } from 'vitest';

import { resolveTeamsTouched } from './team-ownership';
import type { TeamRegistry } from '../teams/types';

describe('team ownership resolver', () => {
  const registry: TeamRegistry = [
    {
      teamId: 'alpha',
      executionMode: 'structured',
      ownedPaths: ['control-plane/**']
    },
    {
      teamId: 'beta',
      executionMode: 'autonomous',
      ownedPaths: ['apps/**']
    }
  ];

  it('returns ok when each file maps to a single team (T-M15)', () => {
    const result = resolveTeamsTouched(['apps/web/index.tsx', 'control-plane/validate-pr.ts'], registry);

    expect(result.teamOwnershipStatus).toBe('ok');
    expect(result.teamsTouched).toEqual(['alpha', 'beta']);
    expect(result.fileToTeamMap).toEqual({
      'apps/web/index.tsx': 'beta',
      'control-plane/validate-pr.ts': 'alpha'
    });
  });

  it('flags ambiguous ownership when multiple teams match (T-M16)', () => {
    const ambiguousRegistry: TeamRegistry = [
      {
        teamId: 'alpha',
        executionMode: 'structured',
        ownedPaths: ['apps/**']
      },
      {
        teamId: 'beta',
        executionMode: 'autonomous',
        ownedPaths: ['apps/**']
      }
    ];

    const result = resolveTeamsTouched(['apps/web/index.tsx'], ambiguousRegistry);

    expect(result.teamOwnershipStatus).toBe('ambiguous_team_ownership');
    expect(result.teamsTouched).toEqual([]);
  });

  it('flags unowned files when no team matches (T-M17)', () => {
    const result = resolveTeamsTouched(['scripts/local.sh'], registry);

    expect(result.teamOwnershipStatus).toBe('unowned_files');
    expect(result.teamsTouched).toEqual([]);
  });

  it('ignores allowlisted paths (T-M18)', () => {
    const result = resolveTeamsTouched(['.github/workflows/ci.yml'], registry);

    expect(result.teamOwnershipStatus).toBe('ok');
    expect(result.teamsTouched).toEqual([]);
    expect(result.fileToTeamMap).toEqual({});
  });

  it('sorts teamsTouched deterministically (T-M19)', () => {
    const result = resolveTeamsTouched(
      ['apps/web/index.tsx', 'control-plane/validate-pr.ts'],
      registry
    );

    expect(result.teamsTouched).toEqual(['alpha', 'beta']);
  });
});
