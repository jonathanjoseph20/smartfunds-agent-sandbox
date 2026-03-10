import { describe, expect, it } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { loadScopeRegistry } from './scope-registry.ts';
import { validateProfileRequest } from './profile-validation.ts';

const registry = loadScopeRegistry();

describe('profile-validation', () => {
  it('T-PV1 valid lite request passes', () => {
    const result = validateProfileRequest({
      profile: 'lite',
      requestedCapabilities: ['read'],
      mutationIntent: 'none'
    }, registry);

    expect(result).toMatchObject({
      ok: true,
      requestedProfile: 'lite',
      requiredProfile: 'lite',
      profile: 'lite',
      violations: [],
      allowedCapabilities: ['artifact_write', 'read']
    });
    expect(result.scopeClassification.reason).toBe('no_target_scope_provided');
  });

  it('T-PV2 lite repo_write fails', () => {
    const result = validateProfileRequest({
      profile: 'lite',
      requestedCapabilities: ['repo_write']
    }, registry);

    expect(result.ok).toBe(false);
    expect(result.requiredProfile).toBe('build');
    expect(result.violations).toEqual([
      'capability_repo_write_requires_build_profile',
      'profile_lite_disallows_repo_write'
    ]);
  });

  it('T-PV3 build protected_write fails with explicit core requirement', () => {
    const result = validateProfileRequest({
      profile: 'build',
      requestedCapabilities: ['protected_write']
    }, registry);

    expect(result.ok).toBe(false);
    expect(result.requiredProfile).toBe('core');
    expect(result.coreReasons).toContain('capability_requires_core_profile');
    expect(result.violations).toEqual([
      'capability_protected_write_requires_core_profile',
      'profile_build_disallows_protected_write'
    ]);
  });

  it('T-PV4 core protected_write passes', () => {
    const result = validateProfileRequest({
      profile: 'core',
      requestedCapabilities: ['protected_write', 'read'],
      mutationIntent: 'governance_change',
      targetScope: {
        repo: 'smartfunds-agent-sandbox',
        paths: ['control-plane/policy/types.ts']
      }
    }, registry);

    expect(result.ok).toBe(true);
    expect(result.requiredProfile).toBe('core');
    expect(result.scopeClassification.reason).toBe('target_scope_matches_core_registry');
    expect(result.violations).toEqual([]);
  });

  it('T-PV5 unknown profile fails', () => {
    const result = validateProfileRequest({
      profile: 'unknown-profile',
      requestedCapabilities: ['read']
    }, registry);

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(['unknown_profile_unknown-profile']);
    expect(result.allowedCapabilities).toEqual([]);
  });

  it('T-PV6 unknown repo fails conservatively as core', () => {
    const result = validateProfileRequest({
      profile: 'build',
      requestedCapabilities: ['read'],
      targetScope: {
        repo: 'unknown-repo'
      }
    }, registry);

    expect(result.ok).toBe(false);
    expect(result.requiredProfile).toBe('core');
    expect(result.scopeClassification.reason).toBe('target_repo_unmapped_defaults_core');
    expect(result.violations).toEqual([
      'profile_build_disallows_target_repo',
      'target_scope_requires_core_profile'
    ]);
  });

  it('T-PV7 core scope path in build request fails with core boundary violation', () => {
    const result = validateProfileRequest({
      profile: 'build',
      requestedCapabilities: ['read'],
      targetScope: {
        repo: 'smartfunds-agent-sandbox',
        paths: ['control-plane/policy/types.ts']
      }
    }, registry);

    expect(result.ok).toBe(false);
    expect(result.coreScopeMatched).toBe(true);
    expect(result.violations).toEqual([
      'build_cannot_target_core_scope',
      'profile_build_disallows_target_path_control-plane/policy/types.ts',
      'target_scope_requires_core_profile'
    ]);
  });

  it('T-PV8 emits sorted violations and classification metadata deterministically', () => {
    const result = validateProfileRequest({
      profile: 'lite',
      requestedCapabilities: ['repo_write', 'protected_write', 'read'],
      mutationIntent: 'code_change',
      targetScope: {
        repo: 'z-repo',
        paths: ['z/path.ts', 'a/path.ts']
      }
    }, registry);

    expect(result.allowedCapabilities).toEqual(['artifact_write', 'read']);
    expect(result.requiredProfile).toBe('core');
    expect(result.violations).toEqual([
      'capability_protected_write_requires_core_profile',
      'capability_repo_write_requires_build_profile',
      'mutation_intent_code_change_requires_build_profile',
      'profile_lite_disallows_mutation_intent_code_change',
      'profile_lite_disallows_protected_write',
      'profile_lite_disallows_repo_write',
      'profile_lite_disallows_target_path_a/path.ts',
      'profile_lite_disallows_target_path_z/path.ts',
      'profile_lite_disallows_target_repo',
      'target_scope_requires_core_profile'
    ]);
  });

  it('T-PV9 produces stable serialized output', () => {
    const result = validateProfileRequest({
      profile: 'build',
      requestedCapabilities: ['protected_write', 'repo_write'],
      targetScope: {
        repo: 'smartfunds-agent-sandbox',
        paths: ['control-plane/x.ts', 'apps/x.ts']
      }
    }, registry);

    expect(canonicalStringify(result)).toBe(canonicalStringify({
      ok: false,
      requestedProfile: 'build',
      requiredProfile: 'core',
      profile: 'build',
      scopeClassification: {
        requiredProfile: 'core',
        reason: 'target_scope_matches_core_registry',
        coreScopeMatched: true,
        allowedForBuild: false,
        matchedBuildPaths: ['apps/x.ts'],
        matchedCorePaths: ['control-plane/x.ts'],
        unmatchedPaths: []
      },
      coreScopeMatched: true,
      coreReasons: ['capability_requires_core_profile', 'target_scope_matches_core_registry'],
      mutationIntentClassification: {
        intent: 'none',
        normalizedIntent: 'none',
        requiredProfile: 'lite',
        reason: 'mutation_intent_non_mutating'
      },
      capabilityClassifications: [
        {
          capability: 'protected_write',
          requiredProfile: 'core',
          reason: 'capability_requires_core_profile'
        },
        {
          capability: 'repo_write',
          requiredProfile: 'build',
          reason: 'capability_requires_build_profile'
        }
      ],
      violations: [
        'build_cannot_target_core_scope',
        'capability_protected_write_requires_core_profile',
        'profile_build_disallows_protected_write',
        'profile_build_disallows_target_path_control-plane/x.ts',
        'target_scope_requires_core_profile'
      ],
      allowedCapabilities: ['artifact_write', 'pr_open', 'read', 'repo_write']
    }));
  });

  it('T-SPC-PV10 build accepts ui_change mutation intent on allowed scope', () => {
    const result = validateProfileRequest({
      profile: 'build',
      requestedCapabilities: ['artifact_write', 'pr_open', 'read', 'repo_write'],
      mutationIntent: 'ui_change',
      targetScope: {
        repo: 'smartfunds-agent-sandbox',
        paths: ['dashboard/ui/index.html']
      }
    }, registry);

    expect(result.ok).toBe(true);
    expect(result.requiredProfile).toBe('build');
    expect(result.violations).toEqual([]);
  });
});
