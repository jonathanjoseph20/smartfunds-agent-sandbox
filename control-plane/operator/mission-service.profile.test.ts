import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createExecutionJournal } from '../journal/journal.ts';
import { createMissionService } from './mission-service.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-service-profile');
const missionsDir = path.join(tmpRoot, 'missions');
const workflowsDir = path.join(tmpRoot, 'workflows');
const teamsDir = path.join(tmpRoot, 'teams');
const agentsDir = path.join(tmpRoot, 'agents');
const journalRoot = path.join(tmpRoot, 'journal');

function writeJson(dir: string, fileName: string, value: unknown): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeAgentProfile(agentId: string): void {
  writeJson(agentsDir, `${agentId}.json`, {
    agentId,
    displayName: agentId,
    role: 'analyst',
    projectId: 'smartfunds-core',
    adapterType: 'llm',
    personalityProfile: {
      tone: 'precise',
      reasoningStyle: 'structured',
      temperament: 'calm',
      collaborationStyle: 'direct',
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
      allowedAdapters: ['llm', 'repo', 'shell'],
      preferredTools: ['llm'],
      forbiddenTools: []
    }
  });
}

function writeFixtures(): void {
  writeJson(teamsDir, 'smartfunds-research-team.json', {
    teamId: 'smartfunds-research-team',
    name: 'SmartFunds Research Team',
    projectId: 'smartfunds-core',
    members: ['lead-thesis-architect'],
    executionMode: 'structured'
  });
  writeAgentProfile('lead-thesis-architect');

  writeJson(missionsDir, 'lite-ok.json', {
    missionId: 'lite-ok',
    projectId: 'smartfunds-core',
    teamId: 'smartfunds-research-team',
    workflowId: 'lite-ok-workflow',
    profile: 'lite',
    mutationIntent: 'none',
    requestedCapabilities: ['artifact_write', 'read'],
    objective: 'lite run',
    successCriteria: ['write artifact'],
    deliverables: ['lite-output.md'],
    initialContext: {
      declaredArtifacts: [{ artifactId: 'lite-output', format: 'markdown' }],
      taskInputsByNode: {
        'write-lite-output': {
          artifactId: 'lite-output',
          content: '# Lite Output\n\nArtifact only.\n'
        }
      }
    }
  });

  writeJson(missionsDir, 'lite-bad-capability.json', {
    missionId: 'lite-bad-capability',
    projectId: 'smartfunds-core',
    teamId: 'smartfunds-research-team',
    workflowId: 'lite-ok-workflow',
    profile: 'lite',
    mutationIntent: 'none',
    requestedCapabilities: ['repo_write'],
    objective: 'bad capability',
    successCriteria: [],
    deliverables: [],
    initialContext: {}
  });

  writeJson(missionsDir, 'lite-bad-step.json', {
    missionId: 'lite-bad-step',
    projectId: 'smartfunds-core',
    teamId: 'smartfunds-research-team',
    workflowId: 'lite-bad-step-workflow',
    profile: 'lite',
    mutationIntent: 'none',
    requestedCapabilities: ['artifact_write', 'read'],
    objective: 'bad step',
    successCriteria: [],
    deliverables: [],
    initialContext: {}
  });

  writeJson(missionsDir, 'governed-default.json', {
    missionId: 'governed-default',
    projectId: 'smartfunds-core',
    teamId: 'smartfunds-research-team',
    workflowId: 'governed-default-workflow',
    objective: 'default run',
    successCriteria: [],
    deliverables: [],
    initialContext: {}
  });

  writeJson(workflowsDir, 'lite-ok-workflow.json', {
    workflowId: 'lite-ok-workflow',
    nodes: [
      {
        id: 'write-lite-output',
        task: 'output.write_markdown'
      }
    ]
  });

  writeJson(workflowsDir, 'lite-bad-step-workflow.json', {
    workflowId: 'lite-bad-step-workflow',
    nodes: [
      {
        id: 'repo-step',
        task: 'repo'
      }
    ]
  });

  writeJson(workflowsDir, 'governed-default-workflow.json', {
    workflowId: 'governed-default-workflow',
    nodes: [
      {
        id: 'governed-node',
        task: 'repo'
      }
    ]
  });
}

beforeEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(tmpRoot, { recursive: true });
  writeFixtures();
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.rmSync(path.join('artifacts', 'lite-ok'), { recursive: true, force: true });
  fs.rmSync(path.join('artifacts', 'governed-default'), { recursive: true, force: true });
});

describe('mission-service profile routing', () => {
  it('T-SPB-M1 routes lite mission through lite path, persists artifacts, and labels run metadata', async () => {
    const service = createMissionService({
      journal: createExecutionJournal({ rootDir: journalRoot }),
      missionsDir,
      workflowsDir,
      teamsDir,
      agentsDir
    });

    const result = await service.startMission({
      missionId: 'lite-ok',
      params: {}
    });

    expect(result).toMatchObject({
      missionId: 'lite-ok',
      status: 'completed',
      profile: 'lite',
      executionPath: 'lite'
    });

    const runId = String(result.workflowRun);
    const missionRunMetadata = JSON.parse(
      fs.readFileSync(path.join('artifacts', 'lite-ok', runId, 'run-metadata.json'), 'utf8')
    ) as Record<string, unknown>;

    expect(missionRunMetadata).toMatchObject({
      profile: 'lite',
      executionPath: 'lite',
      missionId: 'lite-ok'
    });

    const journal = createExecutionJournal({ rootDir: journalRoot });
    const runs = journal.listRuns().filter((run) => run.entrypoint.startsWith('mission:lite-ok'));
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      profile: 'lite',
      executionPath: 'lite'
    });
  });

  it('T-SPB-M2 rejects lite forbidden capability requests', async () => {
    const service = createMissionService({
      journal: createExecutionJournal({ rootDir: journalRoot }),
      missionsDir,
      workflowsDir,
      teamsDir,
      agentsDir
    });

    await expect(service.startMission({
      missionId: 'lite-bad-capability',
      params: {}
    })).rejects.toThrowError('LITE_REPO_MUTATION_FORBIDDEN');
  });

  it('T-SPB-M3 rejects lite forbidden mutation task steps', async () => {
    const service = createMissionService({
      journal: createExecutionJournal({ rootDir: journalRoot }),
      missionsDir,
      workflowsDir,
      teamsDir,
      agentsDir
    });

    await expect(service.startMission({
      missionId: 'lite-bad-step',
      params: {}
    })).rejects.toThrowError('LITE_REPO_MUTATION_FORBIDDEN');
  });

  it('T-SPB-M4 preserves default governed behavior for missions without profile', async () => {
    const journal = createExecutionJournal({ rootDir: journalRoot });
    const service = createMissionService({
      journal,
      missionsDir,
      workflowsDir,
      teamsDir,
      agentsDir
    });

    const result = await service.startMission({
      missionId: 'governed-default',
      params: {}
    });

    expect(result).toMatchObject({
      missionId: 'governed-default',
      profile: 'core',
      executionPath: 'governed'
    });

    const runs = journal.listRuns();
    expect(runs.some((run) => run.entrypoint.startsWith('workflow:governed-default-workflow:'))).toBe(true);
  });
});
