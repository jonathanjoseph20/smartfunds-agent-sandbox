import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { createExecutionJournal } from '../journal/journal.ts';
import { createOperatorCommandRouter } from './command-router.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-operator');
const journalRoot = path.join(tmpRoot, 'journal');
const missionsDir = path.join(tmpRoot, 'missions');
const teamsDir = path.join(tmpRoot, 'teams');
const agentsDir = path.join(tmpRoot, 'agents');
const workflowsDir = path.join(tmpRoot, 'workflows');

function resetTmpDir(): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(journalRoot, { recursive: true });
  fs.mkdirSync(missionsDir, { recursive: true });
  fs.mkdirSync(teamsDir, { recursive: true });
  fs.mkdirSync(agentsDir, { recursive: true });
  fs.mkdirSync(workflowsDir, { recursive: true });
}

function writeJson(dir: string, fileName: string, value: unknown): void {
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
      allowedAdapters: ['llm', 'repo', 'shell'],
      preferredTools: ['llm'],
      forbiddenTools: []
    }
  });
}

function writeFixtures(): void {
  writeJson(missionsDir, 'rwa-market-analysis.json', {
    missionId: 'rwa-market-analysis',
    projectId: 'smartfunds-core',
    teamId: 'smartfunds-research-team',
    workflowId: 'research-analysis-workflow',
    objective: 'Analyze near-term tokenized RWA opportunities.',
    successCriteria: ['Produce market landscape summary'],
    deliverables: ['market-summary'],
    parameterSchema: {
      allowed: ['market', 'horizon', 'risk-level'],
      required: ['market'],
      defaults: {
        horizon: '30d',
        'risk-level': 'medium'
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

  writeAgentProfile('lead-thesis-architect');

  writeJson(workflowsDir, 'research-analysis-workflow.json', {
    workflowId: 'research-analysis-workflow',
    nodes: [
      {
        id: 'node-a',
        task: 'repo'
      }
    ]
  });

  writeJson(workflowsDir, 'wf-failure.json', {
    workflowId: 'wf-failure',
    nodes: [
      {
        id: 'node-fail',
        task: 'repo'
      }
    ]
  });
}

function createRouter() {
  return createOperatorCommandRouter({
    rootDir: journalRoot,
    missionsDir,
    teamsDir,
    agentsDir,
    workflowsDir
  });
}

function seedFailedRun(input: { missionId: string }): { runId: string } {
  const journal = createExecutionJournal({ rootDir: journalRoot });
  const created = journal.createRun({
    projectId: 'smartfunds-core',
    kind: 'mission',
    entrypoint: `mission:${input.missionId}`
  });

  journal.appendEvent({
    runId: created.runId,
    type: 'TASK_STARTED',
    phase: 'implement',
    taskId: 'node-fail',
    payload: {
      context_snapshot: {
        missionId: input.missionId,
        metadata: {
          missionId: input.missionId,
          workflowId: 'wf-failure'
        },
        memory: {}
      }
    }
  });

  journal.appendEvent({
    runId: created.runId,
    type: 'TASK_FAILED',
    phase: 'implement',
    taskId: 'node-fail',
    payload: {
      error: 'ADAPTER_EXECUTION_FAILED',
      context_snapshot: {
        missionId: input.missionId,
        metadata: {
          missionId: input.missionId,
          workflowId: 'wf-failure'
        },
        memory: {}
      }
    }
  });

  return {
    runId: created.runId
  };
}

function seedRunningRun(input: { missionId: string }): { runId: string } {
  const journal = createExecutionJournal({ rootDir: journalRoot });
  const created = journal.createRun({
    projectId: 'smartfunds-core',
    kind: 'mission',
    entrypoint: `mission:${input.missionId}`
  });

  journal.appendEvent({
    runId: created.runId,
    type: 'TASK_STARTED',
    phase: 'implement',
    taskId: 'node-fail',
    payload: {
      context_snapshot: {
        missionId: input.missionId,
        metadata: {
          missionId: input.missionId,
          workflowId: 'wf-failure'
        },
        memory: {}
      }
    }
  });

  return {
    runId: created.runId
  };
}

beforeEach(() => {
  resetTmpDir();
  writeFixtures();
});

describe('operator integration', () => {
  it('T-OPI1 runs mission:start through hardened runtime and propagates mission parameters', async () => {
    const router = createRouter();

    const started = await router.route({
      source: 'cli',
      argv: ['mission:start', 'rwa-market-analysis', '--market', 'ethereum']
    });

    expect(started.success).toBe(true);
    expect(started.payload).toEqual(expect.objectContaining({
      missionId: 'rwa-market-analysis',
      missionParameters: {
        horizon: '30d',
        market: 'ethereum',
        'risk-level': 'medium'
      }
    }));

    const journal = createExecutionJournal({ rootDir: journalRoot });
    const runs = journal.listRuns();
    const missionRun = runs.find((run) => run.entrypoint === 'mission:rwa-market-analysis');
    expect(missionRun).toBeDefined();

    const missionEvents = journal.inspectRun(missionRun!.runId).events;
    expect(missionEvents.some((event) => event.type === 'RUN_COMPLETED')).toBe(true);

    const taskStarted = missionEvents.find((event) => event.type === 'TASK_STARTED');
    expect(taskStarted?.payload.context_snapshot).toMatchObject({
      memory: {
        missionParameters: {
          horizon: '30d',
          market: 'ethereum',
          'risk-level': 'medium'
        }
      }
    });

    const childRun = runs.find((run) => run.entrypoint.startsWith('workflow:research-analysis-workflow:node-a'));
    expect(childRun).toBeDefined();
    const childCreated = journal.inspectRun(childRun!.runId).events.find((event) => event.type === 'RUN_CREATED');
    expect(childCreated?.payload.context_snapshot).toMatchObject({
      memory: {
        missionParameters: {
          horizon: '30d',
          market: 'ethereum',
          'risk-level': 'medium'
        }
      }
    });
  });

  it('T-OPI2 returns deterministic mission/workflow inspection payloads', async () => {
    const router = createRouter();

    const started = await router.route({
      source: 'cli',
      argv: ['mission:start', 'rwa-market-analysis', '--market', 'ethereum']
    });

    const missionList = await router.route({
      source: 'cli',
      argv: ['mission:list']
    });
    const missionInspect = await router.route({
      source: 'cli',
      argv: ['mission:inspect', 'rwa-market-analysis']
    });

    expect(missionList.success).toBe(true);
    expect(missionInspect.success).toBe(true);

    const workflowRun = (started.payload as Record<string, unknown>).workflowRun as string;

    const workflowList = await router.route({
      source: 'cli',
      argv: ['workflow:list']
    });
    const workflowInspect = await router.route({
      source: 'cli',
      argv: ['workflow:inspect', workflowRun]
    });
    const workflowTrace = await router.route({
      source: 'cli',
      argv: ['workflow:trace', workflowRun]
    });

    expect(workflowList.success).toBe(true);
    expect(workflowInspect.success).toBe(true);
    expect(workflowTrace.success).toBe(true);
    expect((workflowTrace.payload as Record<string, unknown>).executionOrder).toEqual(['node-a']);

    const inspectPayload = workflowInspect.payload as Record<string, unknown>;
    expect(inspectPayload.lifecycleStatus).toBe('succeeded');
    expect(inspectPayload.attemptCount).toBe(1);
    expect(inspectPayload.currentAttemptIndex).toBe(0);
    expect(inspectPayload.retryCount).toBe(0);
    expect(Array.isArray(inspectPayload.artifacts)).toBe(true);
    expect(Array.isArray(inspectPayload.attempts)).toBe(true);
    expect((inspectPayload.runtime as Record<string, unknown>).status).toBe('succeeded');
  });

  it('T-OPI3 routes runtime controls through recovery paths', async () => {
    const router = createRouter();

    const failed = seedFailedRun({ missionId: 'retry-mission' });
    const retry = await router.route({
      source: 'cli',
      argv: ['workflow:retry', '--run', failed.runId, '--node', 'node-fail']
    });
    expect(retry.success).toBe(true);

    const failedForResume = seedFailedRun({ missionId: 'resume-mission' });
    const resume = await router.route({
      source: 'cli',
      argv: ['workflow:resume', '--run', failedForResume.runId]
    });
    expect(resume.success).toBe(true);

    const runningForCancel = seedRunningRun({ missionId: 'cancel-workflow-mission' });
    const cancel = await router.route({
      source: 'cli',
      argv: ['workflow:cancel', '--run', runningForCancel.runId]
    });
    expect(cancel).toEqual({
      success: true,
      command: {
        name: 'workflow:cancel',
        source: 'cli'
      },
      payload: {
        runId: runningForCancel.runId,
        workflowId: 'wf-failure',
        status: 'cancelled'
      }
    });

    const runningForMissionCancel = seedRunningRun({ missionId: 'cancel-me' });
    const missionCancel = await router.route({
      source: 'cli',
      argv: ['mission:cancel', 'cancel-me']
    });
    expect(missionCancel.success).toBe(true);
    expect(missionCancel.payload).toEqual({
      missionId: 'cancel-me',
      runId: runningForMissionCancel.runId,
      status: 'cancelled'
    });

    const validation = await router.route({
      source: 'cli',
      argv: ['workflow:retry', '--run', failed.runId]
    });
    expect(validation).toEqual({
      success: false,
      command: {
        name: 'workflow:retry',
        source: 'cli'
      },
      error: {
        code: 'MISSING_ARGUMENT',
        message: 'Missing required --node'
      }
    });
  });

  it('T-OPI4 validates mission parameter requirements deterministically', async () => {
    const router = createRouter();
    const result = await router.route({
      source: 'cli',
      argv: ['mission:start', 'rwa-market-analysis']
    });

    expect(result).toEqual({
      success: false,
      command: {
        name: 'mission:start',
        source: 'cli'
      },
      error: {
        code: 'COMMAND_FAILED',
        message: 'MISSION_PARAM_MISSING_REQUIRED: rwa-market-analysis: market'
      }
    });
  });
});
