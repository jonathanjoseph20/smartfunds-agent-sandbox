import { describe, expect, it } from 'vitest';

import type { MissionDefinition } from '../missions/mission-types.ts';
import { assertLiteTaskAllowed, assertProfileCapabilities, resolveExecutionProfile } from './profile-policy.ts';

function mission(overrides: Partial<MissionDefinition> = {}): MissionDefinition {
  return {
    missionId: 'test-mission',
    projectId: 'smartfunds-core',
    teamId: 'smartfunds-research-team',
    workflowId: 'test-workflow',
    objective: 'test',
    successCriteria: [],
    deliverables: [],
    initialContext: {},
    ...overrides
  };
}

describe('profile-policy', () => {
  it('T-SPB-P1 accepts profile=lite and resolves lite execution path', () => {
    const resolved = resolveExecutionProfile({
      mission: mission({ profile: 'lite' })
    });

    expect(resolved).toEqual({
      profile: 'lite',
      executionPath: 'lite',
      allowedCapabilities: ['artifact_write', 'read']
    });
  });

  it('T-SPB-P2 rejects invalid profile override', () => {
    expect(() => resolveExecutionProfile({
      mission: mission(),
      requestedProfile: 'invalid'
    })).toThrowError('PROFILE_INVALID');
  });

  it('T-SPB-P3 missing profile defaults to governed core behavior', () => {
    const resolved = resolveExecutionProfile({
      mission: mission()
    });

    expect(resolved.profile).toBe('core');
    expect(resolved.executionPath).toBe('governed');
  });

  it('T-SPB-P4 lite rejects forbidden capability requests', () => {
    expect(() => assertProfileCapabilities({
      mission: mission({
        profile: 'lite',
        requestedCapabilities: ['repo_write']
      }),
      profile: 'lite'
    })).toThrowError('LITE_REPO_MUTATION_FORBIDDEN');
  });

  it('T-SPB-P5 lite runtime task boundary rejects forbidden tasks', () => {
    expect(() => assertLiteTaskAllowed('repo')).toThrowError('LITE_REPO_MUTATION_FORBIDDEN');
    expect(() => assertLiteTaskAllowed('open_pr')).toThrowError('LITE_PR_OPEN_FORBIDDEN');
    expect(() => assertLiteTaskAllowed('protected_write')).toThrowError('LITE_PROTECTED_WRITE_FORBIDDEN');
  });
});

