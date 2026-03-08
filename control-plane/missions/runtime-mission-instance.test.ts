import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { createRuntimeMissionInstance } from './runtime-mission-instance.ts';
import { validateMissionTemplateDefinition } from './mission-template-validator.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-s77-runtime-missions');

function resetTmpDir(): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(tmpRoot, { recursive: true });
}

function template() {
  return validateMissionTemplateDefinition({
    missionId: 'tokenization-legal-analysis',
    title: 'Tokenization Compliance Review',
    missionType: 'legal-analysis',
    projectId: 'smartfunds-core',
    workflowId: 'research-analysis-workflow',
    objectives: ['determine if Reg D exemption applies'],
    successCriteria: ['regulatory citations present'],
    deliverables: ['legal-memo.md'],
    artifacts: [{ name: 'legal-memo.md', type: 'document' }],
    teamId: 'smartfunds-legal',
    workflow: ['planning', 'research', 'verification', 'delivery']
  });
}

beforeEach(() => {
  resetTmpDir();
});

describe('runtime-mission-instance', () => {
  it('T-S77-RM1 assigns sequential mission IDs', () => {
    const first = createRuntimeMissionInstance({ template: template(), rootDir: tmpRoot });
    const second = createRuntimeMissionInstance({ template: template(), rootDir: tmpRoot });

    expect(first.missionId).toBe('mission-001');
    expect(second.missionId).toBe('mission-002');
  });
});
