import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { loadTeamDefinitionsFromDir } from './team-loader.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-team-definitions');
const tmpTeamsDir = path.join(tmpRoot, 'definitions');

function resetTmpDir(): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(tmpTeamsDir, { recursive: true });
}

function writeJson(fileName: string, value: unknown): void {
  fs.writeFileSync(path.join(tmpTeamsDir, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createTeam(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    teamId: 'smartfunds-research-team',
    name: 'SmartFunds Research Team',
    projectId: 'smartfunds-core',
    members: ['lead-thesis-architect', 'macro-signal-analyst'],
    executionMode: 'structured',
    ...overrides
  };
}

beforeEach(() => {
  resetTmpDir();
});

describe('team-loader', () => {
  it('T-T4 loads valid team definitions', () => {
    writeJson('team.json', createTeam());

    const teams = loadTeamDefinitionsFromDir(tmpTeamsDir, [
      {
        agentId: 'lead-thesis-architect',
        displayName: 'Lead',
        role: 'lead',
        projectId: 'smartfunds-core',
        adapterType: 'llm',
        personalityProfile: {
          tone: 'tone',
          reasoningStyle: 'reasoning',
          temperament: 'temperament',
          collaborationStyle: 'collaboration',
          communicationStyle: 'communication'
        },
        skillsProfile: { coreSkills: ['a'], secondarySkills: [], domains: ['b'] },
        backgroundProfile: { professionalArchetype: 'arch', domainBackground: ['d'], perspectiveBiases: [] },
        outputProfile: { preferredFormat: 'memo', verbosity: 'medium', citationStyle: 'internal', decisionStyle: 'rank' },
        constraintsProfile: { mustDo: ['do'], mustNotDo: ['dont'] },
        toolProfile: { allowedAdapters: ['llm'], preferredTools: ['llm'], forbiddenTools: ['repo', 'shell'] }
      },
      {
        agentId: 'macro-signal-analyst',
        displayName: 'Macro',
        role: 'analyst',
        projectId: 'smartfunds-core',
        adapterType: 'llm',
        personalityProfile: {
          tone: 'tone',
          reasoningStyle: 'reasoning',
          temperament: 'temperament',
          collaborationStyle: 'collaboration',
          communicationStyle: 'communication'
        },
        skillsProfile: { coreSkills: ['a'], secondarySkills: [], domains: ['b'] },
        backgroundProfile: { professionalArchetype: 'arch', domainBackground: ['d'], perspectiveBiases: [] },
        outputProfile: { preferredFormat: 'memo', verbosity: 'medium', citationStyle: 'internal', decisionStyle: 'rank' },
        constraintsProfile: { mustDo: ['do'], mustNotDo: ['dont'] },
        toolProfile: { allowedAdapters: ['llm'], preferredTools: ['llm'], forbiddenTools: ['repo', 'shell'] }
      }
    ]);

    expect(teams).toHaveLength(1);
    expect(teams[0].teamId).toBe('smartfunds-research-team');
  });

  it('T-T5 rejects duplicate members', () => {
    writeJson('team.json', createTeam({ members: ['macro-signal-analyst', 'macro-signal-analyst'] }));

    expect(() => loadTeamDefinitionsFromDir(tmpTeamsDir)).toThrow(/duplicate members/);
  });
});
