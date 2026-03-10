import { describe, expect, it } from 'vitest';

import { evaluateModePolicy } from './mode-policy.ts';
import { resolveTeamsForChangedFiles } from '../teams/team-resolver.ts';

function evaluateForFiles(changedFiles: string[]) {
  const teamResolution = resolveTeamsForChangedFiles(changedFiles);
  return evaluateModePolicy({
    executionModesTouched: teamResolution.executionModesTouched
  });
}

describe('mode policy docs neutrality', () => {
  it('passes structured code-only changes (T-M11)', () => {
    const result = evaluateForFiles(['control-plane/validate-pr.ts']);
    expect(result.status).toBe('ok');
  });

  it('passes docs-only changes (T-M12)', () => {
    const result = evaluateForFiles(['docs/runbooks/governance-workflow.md']);
    expect(result.status).toBe('ok');
  });

  it('passes code+docs without mixed-mode failure (T-M13)', () => {
    const result = evaluateForFiles(['control-plane/validate-pr.ts', 'docs/README.md']);
    expect(result.status).toBe('ok');
    expect(result.violation).toBeNull();
  });

  it('preserves autonomous-only behavior for non-doc paths (T-M14)', () => {
    const result = evaluateForFiles(['apps/web/index.tsx']);
    expect(result.status).toBe('ok');
    expect(result.requiredMinimumTier).toBeNull();
  });
});
