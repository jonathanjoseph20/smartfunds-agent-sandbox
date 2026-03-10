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

    expect(result).toEqual({
      ok: true,
      profile: 'lite',
      violations: [],
      allowedCapabilities: ['artifact_write', 'read']
    });
  });

  it('T-PV2 lite repo_write fails', () => {
    const result = validateProfileRequest({
      profile: 'lite',
      requestedCapabilities: ['repo_write']
    }, registry);

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(['profile_lite_disallows_repo_write']);
  });

  it('T-PV3 build protected_write fails', () => {
    const result = validateProfileRequest({
      profile: 'build',
      requestedCapabilities: ['protected_write']
    }, registry);

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(['profile_build_disallows_protected_write']);
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

  it('T-PV6 unknown repo fails', () => {
    const result = validateProfileRequest({
      profile: 'build',
      requestedCapabilities: ['read'],
      targetScope: {
        repo: 'unknown-repo'
      }
    }, registry);

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(['profile_build_disallows_target_repo']);
  });

  it('T-PV7 disallowed path fails', () => {
    const result = validateProfileRequest({
      profile: 'build',
      requestedCapabilities: ['read'],
      targetScope: {
        repo: 'smartfunds-agent-sandbox',
        paths: ['control-plane/policy/types.ts']
      }
    }, registry);

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(['profile_build_disallows_target_path_control-plane/policy/types.ts']);
  });

  it('T-PV8 emits sorted violations and allowedCapabilities deterministically', () => {
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
    expect(result.violations).toEqual([
      'profile_lite_disallows_mutation_intent_code_change',
      'profile_lite_disallows_protected_write',
      'profile_lite_disallows_repo_write',
      'profile_lite_disallows_target_path_a/path.ts',
      'profile_lite_disallows_target_path_z/path.ts',
      'profile_lite_disallows_target_repo'
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

    expect(canonicalStringify(result)).toBe(
      canonicalStringify({
        ok: false,
        profile: 'build',
        violations: [
          'profile_build_disallows_protected_write',
          'profile_build_disallows_target_path_control-plane/x.ts'
        ],
        allowedCapabilities: ['artifact_write', 'pr_open', 'read', 'repo_write']
      })
    );
  });
});
