import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { createChargeIntent, executeChargeIntent } from './charge-intent.ts';
import { createSettlementLogStore } from './settlement-log.ts';
import { StripeMockAdapter } from './adapters/stripe-mock.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-finance-exec');
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

beforeEach(() => {
  resetTmpDir();
  writeJson(path.join(projectsDir, 'alpha-project.json'), {
    projectId: 'alpha-project',
    ownedPaths: ['control-plane/**']
  });
  writeJson(entityRegistryPath, [
    {
      entityId: 'alpha-entity',
      legalName: 'Alpha Entity',
      projects: ['alpha-project'],
      complianceProfile: 'phase-1',
      custodyMode: 'non_custodial'
    }
  ]);
  writeJson(railsRegistryPath, {
    version: 1,
    entities: [
      {
        entityId: 'alpha-entity',
        railProfile: 'hybrid'
      }
    ]
  });
});

describe('executeChargeIntent', () => {
  it('executes and logs deterministically', () => {
    const intent = createChargeIntent(
      {
        entityId: 'alpha-entity',
        railProfileId: 'hybrid',
        amount: '100.00',
        currency: 'USD',
        counterparty: 'customer-1',
        purpose: 'subscription'
      },
      { entityRegistryPath, projectsDir, railsRegistryPath }
    );

    const log = createSettlementLogStore();
    const { updatedIntent, result, logEntry } = executeChargeIntent(intent, StripeMockAdapter, log);

    expect(updatedIntent.status).toBe('EXECUTED');
    expect(result.outcome).toBe('EXECUTED');
    expect(logEntry.entryId).toBe(`sl_${intent.determinismHash.slice(0, 12)}_001`);
    expect(log.listByIntentHash(intent.determinismHash)).toHaveLength(1);
  });
});
