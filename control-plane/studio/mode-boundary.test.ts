import { describe, expect, it } from 'vitest';

import { computeExecutionModesTouched, enforceModeBoundary } from './mode-boundary';
import type { TeamRegistry } from '../teams/types';

describe('mode boundary enforcement', () => {
  const registry: TeamRegistry = [
    { teamId: 'alpha', executionMode: 'structured', ownedPaths: ['control-plane/**'] },
    { teamId: 'beta', executionMode: 'structured', ownedPaths: ['packages/**'] },
    { teamId: 'gamma', executionMode: 'autonomous', ownedPaths: ['apps/**'] }
  ];

  it('passes when only structured teams are touched (T-M20)', () => {
    const modes = computeExecutionModesTouched(['alpha', 'beta'], registry);
    const result = enforceModeBoundary(modes, ['beta', 'alpha'], ['packages/a.ts', 'control-plane/b.ts']);

    expect(modes).toEqual(['structured']);
    expect(result.modeBoundaryStatus).toBe('ok');
  });

  it('passes when only autonomous teams are touched (T-M21)', () => {
    const modes = computeExecutionModesTouched(['gamma'], registry);
    const result = enforceModeBoundary(modes, ['gamma'], ['apps/web/index.tsx']);

    expect(modes).toEqual(['autonomous']);
    expect(result.modeBoundaryStatus).toBe('ok');
  });

  it('fails when both structured and autonomous teams are touched (T-M22)', () => {
    const modes = computeExecutionModesTouched(['gamma', 'alpha'], registry);
    const result = enforceModeBoundary(modes, ['gamma', 'alpha'], ['apps/web/index.tsx', 'control-plane/foo.ts']);

    expect(modes).toEqual(['autonomous', 'structured']);
    expect(result.modeBoundaryStatus).toBe('multi_mode_conflict');
    expect(result.conflictingTeams).toEqual(['alpha', 'gamma']);
    expect(result.conflictingPaths).toEqual(['apps/web/index.tsx', 'control-plane/foo.ts']);
    expect(result.nextActions).toEqual([
      'Split PR into separate mode-specific changes.',
      'Ensure each PR touches only structured OR only autonomous teams.'
    ]);
  });
});
