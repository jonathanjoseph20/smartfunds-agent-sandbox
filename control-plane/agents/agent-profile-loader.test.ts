import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { loadAgentProfilesFromDir } from './agent-profile-loader.ts';

const tmpProfilesDir = path.join('control-plane', '__tests__', 'tmp-agent-profiles', 'profiles');

function resetTmpDir(): void {
  fs.rmSync(path.join('control-plane', '__tests__', 'tmp-agent-profiles'), { recursive: true, force: true });
  fs.mkdirSync(tmpProfilesDir, { recursive: true });
}

function writeJson(fileName: string, value: unknown): void {
  fs.writeFileSync(path.join(tmpProfilesDir, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createProfile(agentId: string): Record<string, unknown> {
  return {
    agentId,
    displayName: agentId,
    role: 'analyst',
    projectId: 'smartfunds-core',
    adapterType: 'llm',
    personalityProfile: {
      tone: 'precise',
      reasoningStyle: 'structured',
      temperament: 'calm',
      collaborationStyle: 'cooperative',
      communicationStyle: 'concise'
    },
    skillsProfile: {
      coreSkills: ['analysis'],
      secondarySkills: ['summary'],
      domains: ['rwa']
    },
    backgroundProfile: {
      professionalArchetype: 'researcher',
      domainBackground: ['markets'],
      perspectiveBiases: []
    },
    outputProfile: {
      preferredFormat: 'memo',
      verbosity: 'medium',
      citationStyle: 'internal',
      decisionStyle: 'rank'
    },
    constraintsProfile: {
      mustDo: ['be explicit'],
      mustNotDo: ['guess']
    },
    toolProfile: {
      allowedAdapters: ['llm'],
      preferredTools: ['llm'],
      forbiddenTools: ['repo', 'shell']
    }
  };
}

beforeEach(() => {
  resetTmpDir();
});

describe('agent-profile-loader', () => {
  it('T-A5 loads valid profiles in deterministic order', () => {
    writeJson('z.json', createProfile('z-agent'));
    writeJson('a.json', createProfile('a-agent'));

    const loaded = loadAgentProfilesFromDir(tmpProfilesDir);
    expect(loaded.map((entry) => entry.agentId)).toEqual(['a-agent', 'z-agent']);
  });

  it('T-A6 rejects duplicate agentIds', () => {
    writeJson('one.json', createProfile('dup-agent'));
    writeJson('two.json', createProfile('dup-agent'));

    expect(() => loadAgentProfilesFromDir(tmpProfilesDir)).toThrow(/Duplicate agentId detected/);
  });
});
