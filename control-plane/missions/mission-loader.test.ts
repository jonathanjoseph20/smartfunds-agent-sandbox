import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { loadMissionDefinitionsFromDir } from './mission-loader.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-definitions');
const tmpMissionsDir = path.join(tmpRoot, 'definitions');

function resetTmpDir(): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(tmpMissionsDir, { recursive: true });
}

function writeJson(fileName: string, value: unknown): void {
  fs.writeFileSync(path.join(tmpMissionsDir, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createMission(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    missionId: 'rwa-market-analysis',
    name: 'RWA Market Opportunity Analysis',
    projectId: 'smartfunds-core',
    teamId: 'smartfunds-research-team',
    workflowId: 'research-analysis-workflow',
    objective: 'Analyze near-term tokenized RWA opportunities.',
    successCriteria: ['Produce market landscape summary'],
    deliverables: ['market-summary'],
    initialContext: {
      sector: 'RWA'
    },
    ...overrides
  };
}

beforeEach(() => {
  resetTmpDir();
});

describe('mission-loader', () => {
  it('T-M4 loads valid mission contracts', () => {
    writeJson('mission.json', createMission());

    const missions = loadMissionDefinitionsFromDir(tmpMissionsDir);

    expect(missions).toHaveLength(1);
    expect(missions[0].missionId).toBe('rwa-market-analysis');
  });

  it('T-M5 rejects missing teamId', () => {
    writeJson('mission.json', createMission({ teamId: '' }));

    expect(() => loadMissionDefinitionsFromDir(tmpMissionsDir)).toThrow(/teamId must be a non-empty string/);
  });

  it('T-M6 rejects missing workflowId', () => {
    writeJson('mission.json', createMission({ workflowId: '' }));

    expect(() => loadMissionDefinitionsFromDir(tmpMissionsDir)).toThrow(/workflowId must be a non-empty string/);
  });
});
