import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { assertMissionArtifacts } from './mission-artifact-verifier.ts';
import { validateMissionTemplateDefinition } from './mission-template-validator.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-s77-artifacts');
const artifactsDir = path.join(tmpRoot, 'artifacts');

function resetTmpDir(): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(artifactsDir, { recursive: true });
}

const template = validateMissionTemplateDefinition({
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

beforeEach(() => {
  resetTmpDir();
});

describe('mission-artifact-verifier', () => {
  it('T-S77-A1 fails verification when required artifacts are missing', () => {
    expect(() => assertMissionArtifacts({ template, artifactsDir })).toThrow(/MISSION_ARTIFACTS_INVALID/);
  });
});
