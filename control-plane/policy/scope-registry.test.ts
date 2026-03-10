import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { loadScopeRegistry, validateScopeRegistry } from './scope-registry.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-policy-scope-registry');
const tmpRegistryPath = path.join(tmpRoot, 'scope-registry.json');

function resetTmpDir(): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(tmpRoot, { recursive: true });
}

function writeRegistry(value: unknown): void {
  fs.writeFileSync(tmpRegistryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

beforeEach(() => {
  resetTmpDir();
});

describe('scope-registry', () => {
  it('T-P1 loads a valid scope registry deterministically', () => {
    writeRegistry({
      version: 1,
      profiles: {
        core: {
          allowedRepos: ['smartfunds-agent-sandbox'],
          allowedPaths: {
            'smartfunds-agent-sandbox': ['entities/**', 'control-plane/**']
          }
        },
        lite: {
          mutationAllowed: false
        },
        build: {
          allowedRepos: ['smartfunds-agent-sandbox'],
          allowedPaths: {
            'smartfunds-agent-sandbox': ['tools/**', 'apps/**', 'docs/**', 'dashboard/**']
          }
        }
      }
    });

    const loaded = loadScopeRegistry(tmpRegistryPath);

    expect(loaded).toEqual({
      version: 1,
      profiles: {
        lite: {
          mutationAllowed: false
        },
        build: {
          allowedRepos: ['smartfunds-agent-sandbox'],
          allowedPaths: {
            'smartfunds-agent-sandbox': ['apps/**', 'dashboard/**', 'docs/**', 'tools/**']
          }
        },
        core: {
          allowedRepos: ['smartfunds-agent-sandbox'],
          allowedPaths: {
            'smartfunds-agent-sandbox': ['control-plane/**', 'entities/**']
          }
        }
      }
    });
  });

  it('T-P2 rejects malformed scope registry definitions', () => {
    expect(() => validateScopeRegistry({ profiles: {} })).toThrow(/scope-registry.version/);
  });

  it('T-P3 rejects duplicate repositories in allowedRepos', () => {
    writeRegistry({
      version: 1,
      profiles: {
        lite: {
          mutationAllowed: false
        },
        build: {
          allowedRepos: ['smartfunds-agent-sandbox', 'smartfunds-agent-sandbox'],
          allowedPaths: {
            'smartfunds-agent-sandbox': ['apps/**']
          }
        },
        core: {
          allowedRepos: ['smartfunds-agent-sandbox'],
          allowedPaths: {
            'smartfunds-agent-sandbox': ['control-plane/**']
          }
        }
      }
    });

    expect(() => loadScopeRegistry(tmpRegistryPath)).toThrow(/duplicate repositories/);
  });

  it('T-P4 rejects invalid path patterns in allowedPaths', () => {
    writeRegistry({
      version: 1,
      profiles: {
        lite: {
          mutationAllowed: false
        },
        build: {
          allowedRepos: ['smartfunds-agent-sandbox'],
          allowedPaths: {
            'smartfunds-agent-sandbox': ['apps/**', '../secrets/**']
          }
        },
        core: {
          allowedRepos: ['smartfunds-agent-sandbox'],
          allowedPaths: {
            'smartfunds-agent-sandbox': ['control-plane/**']
          }
        }
      }
    });

    expect(() => loadScopeRegistry(tmpRegistryPath)).toThrow(/invalid path pattern/);
  });
});
