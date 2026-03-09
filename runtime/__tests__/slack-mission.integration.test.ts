import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMissionService } from '../../control-plane/operator/mission-service.ts';
import { createWorkflowService } from '../../control-plane/operator/workflow-service.ts';
import { createMissionController } from '../mission/mission-controller.ts';
import { createSlackNotifier } from '../adapters/slack/slack-notifier.ts';
import { createSlackRouter } from '../adapters/slack/slack-router.ts';
import { registerSlackEvents } from '../adapters/slack/slack-events.ts';

const tmpRoot = path.join('runtime', '__tests__', 'tmp-s84-slack');
const journalRoot = path.join(tmpRoot, 'journal');
const missionsDir = path.join(tmpRoot, 'missions');
const teamsDir = path.join(tmpRoot, 'teams');
const agentsDir = path.join(tmpRoot, 'agents');
const workflowsDir = path.join(tmpRoot, 'workflows');
const missionId = 's84-slack-research';

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
    workflowId: 's84-slack-workflow',
    objective: 'Slack integration mission.',
    successCriteria: ['Run through mission service.'],
    deliverables: ['report'],
    initialContext: {
      topic: 'slack'
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
      allowedAdapters: ['llm', 'repo'],
      preferredTools: ['repo'],
      forbiddenTools: []
    }
  });

  writeJson(workflowsDir, 's84-slack-workflow.json', {
    workflowId: 's84-slack-workflow',
    nodes: [
      {
        id: 'extract-content',
        task: 'repo'
      }
    ]
  });
}

type MissionHandler = (payload: {
  ack?: () => Promise<void>;
  command?: Record<string, unknown>;
  respond?: (response: { response_type: 'ephemeral'; text: string }) => Promise<void>;
}) => Promise<void>;

function buildAppHarness(): {
  app: {
    command: (name: string, handler: MissionHandler) => void;
  };
  handler: () => MissionHandler;
} {
  const handlers = new Map<string, MissionHandler>();
  return {
    app: {
      command: (name, handler) => {
        handlers.set(name, handler);
      }
    },
    handler: () => {
      const handler = handlers.get('/mission');
      if (!handler) {
        throw new Error('missing /mission handler');
      }
      return handler;
    }
  };
}

beforeEach(() => {
  resetFixtures();
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.rmSync(path.join('artifacts', missionId), { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('slack mission integration', () => {
  it('T-S84-I1 routes /mission run/status/artifacts through existing mission control path with completion notification', async () => {
    const missionService = createMissionService({
      rootDir: journalRoot,
      missionsDir,
      teamsDir,
      agentsDir,
      workflowsDir
    });
    const workflowService = createWorkflowService({
      rootDir: journalRoot
    });

    const missionStartSpy = vi.spyOn(missionService, 'startMission');
    const sendMessage = vi.fn(async () => undefined);
    const notifier = createSlackNotifier({
      channel: 'C-OPS',
      sendMessage
    });

    const controller = createMissionController({
      missionService,
      workflowService,
      onMissionCompleted: (payload) => notifier.notifyMissionCompleted(payload)
    });
    const router = createSlackRouter(controller);

    const harness = buildAppHarness();
    registerSlackEvents({
      app: harness.app,
      router
    });

    const missionHandler = harness.handler();

    const runResponses: Array<{ response_type: 'ephemeral'; text: string }> = [];
    await missionHandler({
      ack: async () => undefined,
      command: {
        text: `run ${missionId}`
      },
      respond: async (response) => {
        runResponses.push(response);
      }
    });

    expect(missionStartSpy).toHaveBeenCalledWith({ missionId, params: {} });
    expect(runResponses).toHaveLength(1);

    const runText = runResponses[0].text;
    expect(runText).toContain('Mission started');
    const runIdLine = runText.split('\n').find((line) => line.startsWith('runId: '));
    const runId = runIdLine?.slice('runId: '.length) ?? '';
    expect(runId).toMatch(/^run_smartfunds-core_/);

    const statusResponses: Array<{ response_type: 'ephemeral'; text: string }> = [];
    await missionHandler({
      ack: async () => undefined,
      command: {
        text: `status ${runId}`
      },
      respond: async (response) => {
        statusResponses.push(response);
      }
    });

    expect(statusResponses[0]?.text).toContain(`runId: ${runId}`);
    expect(statusResponses[0]?.text).toContain('status: completed');

    const artifactResponses: Array<{ response_type: 'ephemeral'; text: string }> = [];
    await missionHandler({
      ack: async () => undefined,
      command: {
        text: `artifacts ${runId}`
      },
      respond: async (response) => {
        artifactResponses.push(response);
      }
    });

    expect(artifactResponses).toHaveLength(1);
    expect(artifactResponses[0]?.text).toBe([
      'Artifacts',
      '',
      'dataset.csv',
      'logs.txt',
      'report.md',
      'summary.json'
    ].join('\n'));

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const completionText = String(sendMessage.mock.calls[0]?.[0]?.text);
    expect(completionText).toBe([
      'Mission completed',
      '',
      `mission: ${missionId}`,
      `runId: ${runId}`,
      '',
      'Artifacts available',
      'dataset.csv',
      'logs.txt',
      'report.md',
      'summary.json'
    ].join('\n'));

    const artifactDir = path.join('artifacts', missionId, runId);
    expect(fs.existsSync(path.join(artifactDir, 'report.md'))).toBe(true);
    expect(fs.existsSync(path.join(artifactDir, 'dataset.csv'))).toBe(true);
  });
});
