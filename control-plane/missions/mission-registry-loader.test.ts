import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { loadMissionRegistryBundle, validateMissionTemplateAgainstRegistry } from './mission-registry-loader.ts';
import { validateMissionTemplateDefinition } from './mission-template-validator.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-s77-registry');
const registryPath = path.join(tmpRoot, 'registry.json');
const teamsDir = path.join(tmpRoot, 'teams');
const agentsDir = path.join(tmpRoot, 'agents');

function resetTmpDir(): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(teamsDir, { recursive: true });
  fs.mkdirSync(agentsDir, { recursive: true });
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeBaseFixtures(): void {
  writeJson(registryPath, {
    schemaVersion: 1,
    teams: ['research-core', 'smartfunds-legal']
  });

  writeJson(path.join(teamsDir, 'smartfunds-legal.json'), {
    teamId: 'smartfunds-legal',
    teamType: 'specialized',
    persistence: 'persistent',
    description: 'legal',
    capabilities: ['securities-law'],
    missionCompatibility: ['legal-analysis'],
    tools: ['web-search'],
    roles: [{ slotId: 'lead', agentId: 'tokenization-compliance-expert' }]
  });

  writeJson(path.join(teamsDir, 'research-core.json'), {
    teamId: 'research-core',
    teamType: 'persistent',
    persistence: 'persistent',
    description: 'research',
    capabilities: ['research'],
    missionCompatibility: ['research'],
    tools: ['web-search'],
    roles: [{ slotId: 'lead', agentId: 'research-generalist' }]
  });

  writeJson(path.join(agentsDir, 'tokenization-compliance-expert.json'), {
    agentId: 'tokenization-compliance-expert',
    skills: ['tokenization'],
    personality: { riskPosture: 'conservative', communication: 'structured' },
    tools: ['web-research']
  });

  writeJson(path.join(agentsDir, 'research-generalist.json'), {
    agentId: 'research-generalist',
    skills: ['research'],
    personality: { riskPosture: 'balanced', communication: 'structured' },
    tools: ['web-research']
  });
}

beforeEach(() => {
  resetTmpDir();
  writeBaseFixtures();
});

describe('mission-registry-loader', () => {
  it('T-S77-TR1 validates team registry and deterministic team sorting', () => {
    const bundle = loadMissionRegistryBundle({ registryPath, teamsDir, agentsDir });
    expect(bundle.teams.map((team) => team.teamId)).toEqual(['research-core', 'smartfunds-legal']);
  });

  it('T-S77-TR2 rejects missing team refs from registry', () => {
    writeJson(registryPath, {
      schemaVersion: 1,
      teams: ['research-core', 'smartfunds-legal', 'verifier-audit']
    });

    expect(() => loadMissionRegistryBundle({ registryPath, teamsDir, agentsDir })).toThrow(/missing team definitions/);
  });

  it('T-S77-TR3 rejects unsorted team registry list', () => {
    writeJson(registryPath, {
      schemaVersion: 1,
      teams: ['smartfunds-legal', 'research-core']
    });

    expect(() => loadMissionRegistryBundle({ registryPath, teamsDir, agentsDir })).toThrow(/must be sorted/);
  });

  it('T-S77-TR4 rejects unknown team referenced by mission template', () => {
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
      teamId: 'unknown-team',
      workflow: ['planning', 'research', 'verification', 'delivery']
    });

    const bundle = loadMissionRegistryBundle({ registryPath, teamsDir, agentsDir });
    expect(() => validateMissionTemplateAgainstRegistry(template, bundle)).toThrow(/unknown team/);
  });
});
