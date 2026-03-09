import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMissionService } from '../../control-plane/operator/mission-service.ts';
import { listArtifactsForRun } from '../output/artifact-listing.ts';

const tmpRoot = path.join('runtime', '__tests__', 'tmp-s85-rwa-artifacts');
const journalRoot = path.join(tmpRoot, 'journal');
const missionsDir = path.join(tmpRoot, 'missions');
const teamsDir = path.join(tmpRoot, 'teams');
const agentsDir = path.join(tmpRoot, 'agents');
const workflowsDir = path.join(tmpRoot, 'workflows');
const missionId = 'rwa-market-analysis';

function writeJson(dir: string, fileName: string, value: unknown): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function resetFixtures(): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });

  writeJson(missionsDir, `${missionId}.json`, {
    missionId,
    projectId: 'smartfunds-core',
    teamId: 'smartfunds-research-team',
    workflowId: 'research-analysis-workflow',
    objective: 'Canonical Sprint 85 mission.',
    successCriteria: ['Mission completes.'],
    deliverables: ['report.md', 'dataset.csv', 'search-results.json', 'research-pages.json'],
    parameterSchema: {
      allowed: ['market'],
      required: ['market'],
      defaults: {
        market: 'us'
      }
    },
    initialContext: {
      sector: 'RWA'
    }
  });

  writeJson(teamsDir, 'smartfunds-research-team.json', {
    teamId: 'smartfunds-research-team',
    name: 'SmartFunds Research Team',
    projectId: 'smartfunds-core',
    members: ['lead-thesis-architect'],
    executionMode: 'structured'
  });

  writeJson(agentsDir, 'lead-thesis-architect.json', {
    agentId: 'lead-thesis-architect',
    displayName: 'lead-thesis-architect',
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
      forbiddenTools: []
    }
  });

  writeJson(workflowsDir, 'research-analysis-workflow.json', {
    workflowId: 'research-analysis-workflow',
    nodes: [
      {
        id: 'extract-content',
        task: 'repo'
      }
    ]
  });
}

beforeEach(() => {
  resetFixtures();
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.rmSync(path.join('artifacts', missionId), { recursive: true, force: true });
});

describe('rwa-market-analysis artifact integration', () => {
  it('T-S85-I1 emits canonical artifact files and returns deterministic sorted listing', async () => {
    const missionService = createMissionService({
      rootDir: journalRoot,
      missionsDir,
      teamsDir,
      agentsDir,
      workflowsDir
    });

    const started = await missionService.startMission({
      missionId,
      params: {}
    });
    const runId = String(started.workflowRun);

    const artifactDir = path.join('artifacts', missionId, runId);
    const files = fs.readdirSync(artifactDir).sort((left, right) => left.localeCompare(right));
    expect(files).toEqual(['dataset.csv', 'report.md', 'research-pages.json', 'search-results.json']);

    expect(listArtifactsForRun({ missionId, runId })).toEqual([
      'dataset.csv',
      'report.md',
      'research-pages.json',
      'search-results.json'
    ]);
  });
});
