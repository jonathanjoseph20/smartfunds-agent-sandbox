import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { getRailProfile, listRailProfiles, loadRailsRegistry } from './rails.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-rails-registry');
const registryPath = path.join(tmpRoot, 'rails.json');

function resetTmpDir(): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(tmpRoot, { recursive: true });
}

function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

beforeEach(() => {
  resetTmpDir();
});

describe('rails registry', () => {
  it('loads rails.json deterministically', () => {
    writeJson(registryPath, {
      version: 1,
      entities: [
        { entityId: 'z-entity', railProfile: 'structured-only' },
        { entityId: 'a-entity', railProfile: 'hybrid', description: 'alpha' }
      ]
    });

    const registry = loadRailsRegistry({ registryPath });

    expect(listRailProfiles(registry)).toEqual([
      { entityId: 'a-entity', railProfile: 'hybrid', description: 'alpha' },
      { entityId: 'z-entity', railProfile: 'structured-only' }
    ]);
    expect(getRailProfile('a-entity', registry)).toBe('hybrid');
    expect(getRailProfile('missing-entity', registry)).toBeNull();
  });

  it('rejects duplicate entityId values', () => {
    writeJson(registryPath, {
      version: 1,
      entities: [
        { entityId: 'dup-entity', railProfile: 'hybrid' },
        { entityId: 'dup-entity', railProfile: 'structured-only' }
      ]
    });

    expect(() => loadRailsRegistry({ registryPath })).toThrow(/Duplicate entityId/);
  });

  it('rejects invalid rail profiles', () => {
    writeJson(registryPath, {
      version: 1,
      entities: [
        { entityId: 'core-entity', railProfile: 'invalid-profile' }
      ]
    });

    expect(() => loadRailsRegistry({ registryPath })).toThrow(/railProfile must be one of/);
  });

  it('rejects empty strings', () => {
    writeJson(registryPath, {
      version: 1,
      entities: [
        { entityId: '', railProfile: 'hybrid', description: 'ok' }
      ]
    });

    expect(() => loadRailsRegistry({ registryPath })).toThrow(/entityId must be a non-empty string/);
  });
});
