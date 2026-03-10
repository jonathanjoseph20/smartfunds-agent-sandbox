import { describe, expect, it } from 'vitest';

import { routePrGovernanceProfile } from './pr-profile-routing.ts';

describe('pr-profile-routing', () => {
  it('T-PRR1 detects requested profile from metadata', () => {
    const result = routePrGovernanceProfile({
      prBody: [
        'tier-3',
        '',
        '```evidence',
        'profile: build',
        '```'
      ].join('\n'),
      repository: 'acme/smartfunds-agent-sandbox',
      changedFiles: ['docs/notes.md']
    });

    expect(result.ok).toBe(true);
    expect(result.source).toBe('metadata');
    expect(result.requestedProfile).toBe('build');
    expect(result.requiredProfile).toBe('build');
    expect(result.finalProfile).toBe('build');
    expect(result.matchedScopes).toEqual(['docs/notes.md']);
  });

  it('T-PRR2 falls back to path classification when metadata is absent', () => {
    const result = routePrGovernanceProfile({
      prBody: '',
      repository: 'smartfunds-agent-sandbox',
      changedFiles: ['control-plane/governance/validate.ts']
    });

    expect(result.source).toBe('fallback');
    expect(result.requestedProfile).toBe('lite');
    expect(result.requiredProfile).toBe('core');
    expect(result.finalProfile).toBe('core');
  });

  it('T-PRR3 enforces conservative escalation', () => {
    const result = routePrGovernanceProfile({
      prBody: 'profile: lite',
      repository: 'smartfunds-agent-sandbox',
      changedFiles: ['control-plane/policy/types.ts']
    });

    expect(result.requestedProfile).toBe('lite');
    expect(result.requiredProfile).toBe('core');
    expect(result.finalProfile).toBe('core');
  });

  it('T-PRR4 hard-fails build request touching core scope', () => {
    const result = routePrGovernanceProfile({
      prBody: 'profile: build',
      repository: 'smartfunds-agent-sandbox',
      changedFiles: ['control-plane/governance/validate.ts']
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(['BUILD_REQUESTED_PROFILE_REQUIRES_CORE_SCOPE']);
    expect(result.requiredProfile).toBe('core');
    expect(result.finalProfile).toBe('core');
  });

  it('T-PRR5 resolves lite when no changed files exist', () => {
    const result = routePrGovernanceProfile({
      prBody: 'profile: lite',
      repository: 'smartfunds-agent-sandbox',
      changedFiles: []
    });

    expect(result.ok).toBe(true);
    expect(result.requiredProfile).toBe('lite');
    expect(result.finalProfile).toBe('lite');
    expect(result.matchedScopes).toEqual([]);
  });
});
