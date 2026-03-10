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

  it('T-SPC-P6 resolves profile=build to build execution path', () => {
    const resolved = resolveExecutionProfile({
      mission: mission({ profile: 'build' })
    });

    expect(resolved.profile).toBe('build');
    expect(resolved.executionPath).toBe('build');
    expect(resolved.allowedCapabilities).toEqual(['artifact_write', 'pr_open', 'read', 'repo_write']);
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

  it('T-SPC-P7 build requires repo_write and pr_open and rejects protected_write', () => {
    expect(() => assertProfileCapabilities({
      mission: mission({
        profile: 'build',
        mutationIntent: 'code_change',
        requestedCapabilities: ['pr_open', 'read'],
        targetScope: {
          repo: 'smartfunds-agent-sandbox',
          paths: ['docs/**']
        }
      }),
      profile: 'build'
    })).toThrowError('BUILD_REPO_WRITE_REQUIRED');

    expect(() => assertProfileCapabilities({
      mission: mission({
        profile: 'build',
        mutationIntent: 'code_change',
        requestedCapabilities: ['repo_write', 'read'],
        targetScope: {
          repo: 'smartfunds-agent-sandbox',
          paths: ['docs/**']
        }
      }),
      profile: 'build'
    })).toThrowError('BUILD_PR_OPEN_REQUIRED');

    expect(() => assertProfileCapabilities({
      mission: mission({
        profile: 'build',
        mutationIntent: 'code_change',
        requestedCapabilities: ['artifact_write', 'pr_open', 'protected_write', 'read', 'repo_write'],
        targetScope: {
          repo: 'smartfunds-agent-sandbox',
          paths: ['docs/**']
        }
      }),
      profile: 'build'
    })).toThrowError('PROTECTED_WRITE_REQUIRES_CORE');
  });

  it('T-SPD-P8 build rejects core mutation intent and core scope deterministically', () => {
    expect(() => assertProfileCapabilities({
      mission: mission({
        profile: 'build',
        mutationIntent: 'governance_change',
        requestedCapabilities: ['artifact_write', 'pr_open', 'read', 'repo_write'],
        targetScope: {
          repo: 'smartfunds-agent-sandbox',
          paths: ['docs/**']
        }
      }),
      profile: 'build'
    })).toThrowError('CORE_MUTATION_INTENT_REQUIRED');

    expect(() => assertProfileCapabilities({
      mission: mission({
        profile: 'build',
        mutationIntent: 'code_change',
        requestedCapabilities: ['artifact_write', 'pr_open', 'read', 'repo_write'],
        targetScope: {
          repo: 'smartfunds-agent-sandbox',
          paths: ['control-plane/**']
        }
      }),
      profile: 'build'
    })).toThrowError('BUILD_CANNOT_TARGET_CORE_SCOPE');
  });

  it('T-SPD-P8B core mission on core scope classifies and validates', () => {
    const validation = assertProfileCapabilities({
      mission: mission({
        profile: 'core',
        mutationIntent: 'governance_change',
        requestedCapabilities: ['artifact_write', 'pr_open', 'protected_write', 'read', 'repo_write'],
        targetScope: {
          repo: 'smartfunds-agent-sandbox',
          paths: ['control-plane/policy/scope-registry.json']
        }
      }),
      profile: 'core'
    });

    expect(validation.ok).toBe(true);
    expect(validation.requiredProfile).toBe('core');
    expect(validation.scopeClassification.requiredProfile).toBe('core');
  });

  it('T-SPC-P9 build accepts allowed scope and intent and returns validation metadata', () => {
    const validation = assertProfileCapabilities({
      mission: mission({
        profile: 'build',
        mutationIntent: 'ui_change',
        requestedCapabilities: ['artifact_write', 'pr_open', 'read', 'repo_write'],
        targetScope: {
          repo: 'smartfunds-agent-sandbox',
          paths: ['dashboard/**']
        }
      }),
      profile: 'build'
    });

    expect(validation.ok).toBe(true);
    expect(validation.requiredProfile).toBe('build');
    expect(validation.scopeClassification.requiredProfile).toBe('build');
  });

  it('T-SPC-P10 build requires explicit target scope paths', () => {
    expect(() => assertProfileCapabilities({
      mission: mission({
        profile: 'build',
        mutationIntent: 'code_change',
        requestedCapabilities: ['artifact_write', 'pr_open', 'read', 'repo_write']
      }),
      profile: 'build'
    })).toThrowError('BUILD_TARGET_SCOPE_DENIED');
  });
});
