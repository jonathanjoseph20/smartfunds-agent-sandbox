import { describe, expect, it } from 'vitest';

import { resolveTeamsForChangedFiles } from './team-resolver';
import type { TeamDefinition } from './types';

describe('team resolver', () => {
  it('sorts outputs deterministically (T-M1)', () => {
    const result = resolveTeamsForChangedFiles([
      'docs/z.md',
      'apps/web/page.tsx',
      'control-plane/cli/governance-preflight.ts',
      'docs/a.md'
    ]);

    expect(result.teamsTouched).toEqual(['docs', 'governance', 'product-app']);
    expect(result.executionModesTouched).toEqual(['autonomous', 'structured']);
    expect(result.modeWarnings).toContain('MIXED_MODE_PR');
  });

  it('uses most specific match when broader match also exists (T-M2)', () => {
    const teams: TeamDefinition[] = [
      {
        teamId: 'money-movement',
        executionMode: 'structured',
        ownedPaths: ['packages/billing/**']
      },
      {
        teamId: 'product-app',
        executionMode: 'autonomous',
        ownedPaths: ['packages/**']
      }
    ];

    const result = resolveTeamsForChangedFiles(['packages/billing/core.ts'], teams);
    expect(result.teamsTouched).toEqual(['money-movement']);
    expect(result.executionModesTouched).toEqual(['structured']);
    expect(result.ambiguousPaths).toEqual([]);
  });

  it('detects mixed-mode PRs without changing enforcement (T-M3)', () => {
    const result = resolveTeamsForChangedFiles(['control-plane/foo.ts', 'apps/bar.ts']);

    expect(result.executionModesTouched).toEqual(['autonomous', 'structured']);
    expect(result.modeWarnings).toContain('MIXED_MODE_PR');
  });

  it('reports unowned paths (T-M4)', () => {
    const result = resolveTeamsForChangedFiles(['scripts/dev-tool.ts']);

    expect(result.unownedPaths).toEqual(['scripts/dev-tool.ts']);
    expect(result.modeWarnings).toContain('UNOWNED_PATHS');
  });

  it('reports ambiguous resolution on equal specificity ties (T-M5)', () => {
    const teams: TeamDefinition[] = [
      {
        teamId: 'alpha',
        executionMode: 'autonomous',
        ownedPaths: ['src/shared/**']
      },
      {
        teamId: 'beta',
        executionMode: 'structured',
        ownedPaths: ['src/shared/**']
      }
    ];

    const result = resolveTeamsForChangedFiles(['src/shared/index.ts'], teams);

    expect(result.teamsTouched).toEqual(['alpha']);
    expect(result.ambiguousPaths).toEqual(['src/shared/index.ts']);
    expect(result.modeWarnings).toContain('AMBIGUOUS_OWNERSHIP');
  });
});
