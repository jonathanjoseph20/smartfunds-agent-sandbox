import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, beforeEach } from 'vitest';

import { buildChargeIntentHash, createChargeIntent, type ChargeIntentInput } from './charge-intent.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-finance');
const projectsDir = path.join(tmpRoot, 'projects');
const entityRegistryPath = path.join(tmpRoot, 'registry.json');
const railsRegistryPath = path.join(tmpRoot, 'rails.json');

function resetTmpDir(): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.mkdirSync(projectsDir, { recursive: true });
}

function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function writeProject(projectId: string): void {
  writeJson(path.join(projectsDir, `${projectId}.json`), {
    projectId,
    ownedPaths: ['control-plane/**']
  });
}

function writeEntityRegistry(entityId: string, projectId: string): void {
  writeJson(entityRegistryPath, [
    {
      entityId,
      legalName: 'Alpha Entity',
      projects: [projectId],
      complianceProfile: 'phase-1',
      custodyMode: 'non_custodial'
    }
  ]);
}

function writeRailsRegistry(entityId: string, railProfile: 'structured-only' | 'autonomous-only' | 'hybrid' | 'restricted'): void {
  writeJson(railsRegistryPath, {
    version: 1,
    entities: [
      {
        entityId,
        railProfile
      }
    ]
  });
}

function baseInput(overrides: Partial<ChargeIntentInput> = {}): ChargeIntentInput {
  return {
    entityId: 'alpha-entity',
    railProfileId: 'hybrid',
    amount: '100.00',
    currency: 'USD',
    counterparty: 'customer-1',
    purpose: 'subscription',
    ...overrides
  };
}

beforeEach(() => {
  resetTmpDir();
  writeProject('alpha-project');
  writeEntityRegistry('alpha-entity', 'alpha-project');
  writeRailsRegistry('alpha-entity', 'hybrid');
});

describe('charge intent hashing', () => {
  it('produces deterministic hashes for identical input', () => {
    const intentA = createChargeIntent(baseInput(), {
      entityRegistryPath,
      projectsDir,
      railsRegistryPath
    });
    const intentB = createChargeIntent(baseInput(), {
      entityRegistryPath,
      projectsDir,
      railsRegistryPath
    });

    expect(intentA.determinismHash).toBe(intentB.determinismHash);
  });

  it('canonicalizes metadata key ordering', () => {
    const intentA = createChargeIntent(
      baseInput({ metadata: { b: '2', a: '1' } }),
      { entityRegistryPath, projectsDir, railsRegistryPath }
    );
    const intentB = createChargeIntent(
      baseInput({ metadata: { a: '1', b: '2' } }),
      { entityRegistryPath, projectsDir, railsRegistryPath }
    );

    expect(intentA.determinismHash).toBe(intentB.determinismHash);
  });

  it('omits undefined metadata from hashing', () => {
    const intentA = createChargeIntent(
      baseInput({ metadata: undefined }),
      { entityRegistryPath, projectsDir, railsRegistryPath }
    );
    const intentB = createChargeIntent(
      baseInput(),
      { entityRegistryPath, projectsDir, railsRegistryPath }
    );

    expect(intentA.determinismHash).toBe(intentB.determinismHash);
  });

  it('derives intentId from the determinism hash when absent', () => {
    const intent = createChargeIntent(baseInput(), {
      entityRegistryPath,
      projectsDir,
      railsRegistryPath
    });

    expect(intent.intentId).toBe(`ci_${intent.determinismHash.slice(0, 12)}`);
  });

  it('excludes status from the hash input', () => {
    const intent = createChargeIntent(baseInput(), {
      entityRegistryPath,
      projectsDir,
      railsRegistryPath
    });
    const coreHash = buildChargeIntentHash({
      entityId: intent.entityId,
      railProfileId: intent.railProfileId,
      amount: intent.amount,
      currency: intent.currency,
      counterparty: intent.counterparty,
      purpose: intent.purpose,
      ...(intent.metadata ? { metadata: intent.metadata } : {})
    });

    expect(intent.determinismHash).toBe(coreHash);
  });
});

describe('charge intent validation', () => {
  it('fails when entity is missing', () => {
    writeJson(entityRegistryPath, []);

    expect(() =>
      createChargeIntent(baseInput(), {
        entityRegistryPath,
        projectsDir,
        railsRegistryPath
      })
    ).toThrow(/ERR_ENTITY_NOT_FOUND/);
  });

  it('fails when rail profile is missing', () => {
    writeJson(railsRegistryPath, { version: 1, entities: [] });

    expect(() =>
      createChargeIntent(baseInput(), {
        entityRegistryPath,
        projectsDir,
        railsRegistryPath
      })
    ).toThrow(/ERR_RAIL_PROFILE_MISSING/);
  });

  it('fails when rail profile is incompatible', () => {
    writeRailsRegistry('alpha-entity', 'structured-only');

    expect(() =>
      createChargeIntent(baseInput(), {
        entityRegistryPath,
        projectsDir,
        railsRegistryPath
      })
    ).toThrow(/ERR_RAIL_PROFILE_INCOMPATIBLE/);
  });
});
