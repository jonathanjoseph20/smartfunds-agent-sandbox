import { describe, expect, it } from 'vitest';

import {
  classifyCapability,
  classifyMutationIntent,
  classifyScope,
  resolveRequiredProfile
} from './core-classification.ts';
import { validateScopeRegistry } from './scope-registry.ts';
import type { ScopeRegistry } from './scope-registry.ts';

function registry(overrides: Partial<ScopeRegistry> = {}): ScopeRegistry {
  return {
    version: 1,
    profiles: {
      lite: {
        mutationAllowed: false
      },
      build: {
        allowedRepos: ['smartfunds-agent-sandbox'],
        allowedPaths: {
          'smartfunds-agent-sandbox': ['apps/**', 'dashboard/**', 'docs/**']
        }
      },
      core: {
        allowedRepos: ['smartfunds-agent-sandbox'],
        allowedPaths: {
          'smartfunds-agent-sandbox': ['control-plane/**', 'runtime/**']
        },
        coreOnlyRepos: ['smartfunds-agent-sandbox'],
        coreOnlyPaths: {
          'smartfunds-agent-sandbox': ['control-plane/**', 'runtime/**']
        }
      }
    },
    ...overrides
  };
}

describe('core-classification', () => {
  it('T-PC1 classifies a core scope deterministically', () => {
    const result = classifyScope({
      registry: registry(),
      targetScope: {
        repo: 'smartfunds-agent-sandbox',
        paths: ['control-plane/policy/types.ts']
      }
    });

    expect(result).toEqual({
      requiredProfile: 'core',
      reason: 'target_scope_matches_core_registry',
      coreScopeMatched: true,
      allowedForBuild: false,
      matchedBuildPaths: [],
      matchedCorePaths: ['control-plane/policy/types.ts'],
      unmatchedPaths: []
    });
  });

  it('T-PC2 does not misclassify a build-safe scope as core', () => {
    const result = classifyScope({
      registry: registry(),
      targetScope: {
        repo: 'smartfunds-agent-sandbox',
        paths: ['dashboard/ui/index.html']
      }
    });

    expect(result.requiredProfile).toBe('build');
    expect(result.allowedForBuild).toBe(true);
    expect(result.coreScopeMatched).toBe(false);
  });

  it('T-PC3 handles overlap deterministically by prioritizing core', () => {
    const overlappingRegistry = registry({
      profiles: {
        ...registry().profiles,
        core: {
          ...registry().profiles.core,
          coreOnlyPaths: {
            'smartfunds-agent-sandbox': ['control-plane/**', 'dashboard/**']
          }
        }
      }
    });

    const result = classifyScope({
      registry: overlappingRegistry,
      targetScope: {
        repo: 'smartfunds-agent-sandbox',
        paths: ['dashboard/ui/index.html']
      }
    });

    expect(result.requiredProfile).toBe('core');
    expect(result.reason).toBe('target_scope_matches_core_registry');
    expect(result.matchedBuildPaths).toEqual(['dashboard/ui/index.html']);
    expect(result.matchedCorePaths).toEqual(['dashboard/ui/index.html']);
  });

  it('T-PC4 rejects malformed scope registry definitions used for core classification', () => {
    expect(() => validateScopeRegistry({
      version: 1,
      profiles: {
        lite: { mutationAllowed: false },
        build: {
          allowedRepos: ['smartfunds-agent-sandbox'],
          allowedPaths: {
            'smartfunds-agent-sandbox': ['docs/**']
          }
        },
        core: {
          allowedRepos: ['smartfunds-agent-sandbox'],
          allowedPaths: {
            'smartfunds-agent-sandbox': ['control-plane/**']
          },
          coreOnlyRepos: ['another-repo']
        }
      }
    })).toThrow(/coreOnlyRepos contains repo\(s\) not listed in allowedRepos/);
  });

  it('T-PC5 classifies mutation intents and capabilities deterministically', () => {
    expect(classifyMutationIntent('workflow_change')).toMatchObject({
      requiredProfile: 'core',
      reason: 'mutation_intent_requires_core_profile'
    });
    expect(classifyMutationIntent('financial_rail_mutation')).toMatchObject({
      normalizedIntent: 'financial_logic_change',
      requiredProfile: 'core'
    });
    expect(classifyMutationIntent('ui_change')).toMatchObject({
      requiredProfile: 'build',
      reason: 'mutation_intent_allowed_for_build_profile'
    });

    expect(classifyCapability('protected_write')).toEqual({
      capability: 'protected_write',
      requiredProfile: 'core',
      reason: 'capability_requires_core_profile'
    });
    expect(resolveRequiredProfile(['lite', 'build', 'core'])).toBe('core');
  });
});
