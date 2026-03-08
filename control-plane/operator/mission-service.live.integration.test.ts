import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createExecutionJournal } from '../journal/journal.ts';
import { createMissionService } from './mission-service.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-service-live');
const missionsDir = path.join(tmpRoot, 'missions');
const workflowsDir = path.join(tmpRoot, 'workflows');
const teamsDir = path.join(tmpRoot, 'teams');
const agentsDir = path.join(tmpRoot, 'agents');

const envSnapshot = { ...process.env };

function writeJson(dir: string, fileName: string, value: unknown): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function resetTmp(): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(missionsDir, { recursive: true });
  fs.mkdirSync(workflowsDir, { recursive: true });
  fs.mkdirSync(teamsDir, { recursive: true });
  fs.mkdirSync(agentsDir, { recursive: true });
}

function writeFixtures(): void {
  writeJson(missionsDir, 'live.json', {
    missionId: 'live-mission',
    projectId: 'smartfunds-core',
    teamId: 'smartfunds-research-team',
    workflowId: 'live-workflow',
    objective: 'Live mission test',
    successCriteria: ['done'],
    deliverables: ['report'],
    initialContext: {},
    parameterSchema: {
      allowed: ['live'],
      required: ['live']
    }
  });

  writeJson(workflowsDir, 'live-workflow.json', {
    workflowId: 'live-workflow',
    nodes: [
      { id: 'ws', task: 'web_search' },
      { id: 'wf', task: 'web_fetch', dependsOn: ['ws'] },
      { id: 'ts', task: 'twitter_search', dependsOn: ['ws'] },
      { id: 'llm', task: 'llm_synthesis', dependsOn: ['wf', 'ts'] }
    ]
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
    displayName: 'Lead Thesis Architect',
    role: 'research-lead',
    projectId: 'smartfunds-core',
    adapterType: 'llm',
    personalityProfile: {
      tone: 'measured',
      reasoningStyle: 'structured',
      temperament: 'calm',
      collaborationStyle: 'direct',
      communicationStyle: 'concise'
    },
    skillsProfile: {
      coreSkills: ['analysis'],
      secondarySkills: ['synthesis'],
      domains: ['rwa']
    },
    backgroundProfile: {
      professionalArchetype: 'strategist',
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
      mustDo: ['state assumptions'],
      mustNotDo: ['guess']
    },
    toolProfile: {
      allowedAdapters: ['llm'],
      preferredTools: ['llm'],
      forbiddenTools: ['repo', 'shell']
    }
  });
}

beforeEach(() => {
  resetTmp();
  writeFixtures();
  process.env.LLM_ENABLE_PROVIDER_FAKE = '1';
  process.env.LLM_ENABLE_PROVIDER_GOOGLE = '0';
  vi.stubGlobal('fetch', vi.fn(async () => ({
    status: 200,
    text: async () => '<a href="https://x.com/user/status/1">Post</a><a href="https://example.com/a">A</a><title>Page</title>'
  } as Response)));
});

afterEach(() => {
  process.env = { ...envSnapshot };
  vi.unstubAllGlobals();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission service live integration', () => {
  it('executes mission path through tool tasks and llm synthesis with journal outputs', async () => {
    const journal = createExecutionJournal({ rootDir: tmpRoot });
    const service = createMissionService({
      journal,
      missionsDir,
      workflowsDir,
      teamsDir,
      agentsDir
    });

    const started = await service.startMission({
      missionId: 'live-mission',
      params: { live: 'true' }
    });

    expect(started.status).toBe('completed');

    const runId = String(started.workflowRun);
    const inspected = journal.inspectRun(runId);

    const completedNodes = inspected.events
      .filter((event) => event.type === 'TASK_COMPLETED')
      .map((event) => ({
        taskId: event.taskId,
        output: (event.payload as Record<string, unknown>).task_outputs
      }));

    expect(completedNodes.some((node) => node.taskId === 'ws')).toBe(true);
    expect(completedNodes.some((node) => node.taskId === 'wf')).toBe(true);
    expect(completedNodes.some((node) => node.taskId === 'ts')).toBe(true);
    expect(completedNodes.some((node) => node.taskId === 'llm')).toBe(true);

    const llmNode = completedNodes.find((node) => node.taskId === 'llm');
    expect(llmNode).toBeDefined();
    expect(llmNode?.output).toMatchObject({
      output: {
        runId: expect.any(String),
        status: 'completed',
        completedPhases: expect.any(Array),
        eventCount: expect.any(Number)
      }
    });
  });
});
