import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMissionService } from '../operator/mission-service.ts';
import { createSchedulerService } from './service.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-scheduler-integration');
const missionsDir = path.join(tmpRoot, 'missions');
const workflowsDir = path.join(tmpRoot, 'workflows');
const teamsDir = path.join(tmpRoot, 'teams');
const agentsDir = path.join(tmpRoot, 'agents');
const scheduleRegistryPath = path.join(tmpRoot, 'scheduler-registry.json');
const schedulerJournalRoot = path.join(tmpRoot, 'scheduler-journal');
const missionJournalRoot = path.join(tmpRoot, 'mission-journal');

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

  writeJson(missionsDir, 'scheduler-lite-mission.json', {
    missionId: 'scheduler-lite-mission',
    projectId: 'smartfunds-core',
    teamId: 'smartfunds-research-team',
    workflowId: 'scheduler-lite-workflow',
    profile: 'lite',
    mutationIntent: 'none',
    requestedCapabilities: ['artifact_write', 'read'],
    objective: 'scheduler integration lite run',
    successCriteria: ['write artifact'],
    deliverables: ['scheduler-output.md'],
    initialContext: {
      declaredArtifacts: [{ artifactId: 'scheduler-output', format: 'markdown' }],
      taskInputsByNode: {
        'write-scheduler-output': {
          artifactId: 'scheduler-output',
          content: '# Scheduler Output\n\nDeterministic scheduler launch.\n'
        }
      }
    }
  });

  writeJson(workflowsDir, 'scheduler-lite-workflow.json', {
    workflowId: 'scheduler-lite-workflow',
    nodes: [
      {
        id: 'write-scheduler-output',
        task: 'output.write_markdown'
      }
    ]
  });
}

function writeScheduleRegistry(input: { missionId: string; enabled?: boolean }): void {
  fs.writeFileSync(scheduleRegistryPath, `${JSON.stringify({
    schemaVersion: 1,
    schedules: [
      {
        scheduleId: 'scheduler-daily',
        missionId: input.missionId,
        enabled: input.enabled ?? true,
        cadence: {
          type: 'daily',
          hourUtc: 13,
          minuteUtc: 0
        },
        params: {
          market: 'us'
        }
      }
    ]
  }, null, 2)}\n`, 'utf8');
}

beforeEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(tmpRoot, { recursive: true });
  writeFixtures();
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.rmSync(path.join('artifacts', 'scheduler-lite-mission'), { recursive: true, force: true });
});

describe('scheduler integration', () => {
  it('T-INT1 happy path + runtime integration visibility + duplicate prevention', async () => {
    writeScheduleRegistry({ missionId: 'scheduler-lite-mission' });

    const scheduler = createSchedulerService({
      registryPath: scheduleRegistryPath,
      rootDir: schedulerJournalRoot,
      now: () => new Date('2026-03-10T13:05:00.000Z'),
      missionServiceOptions: {
        rootDir: missionJournalRoot,
        missionsDir,
        teamsDir,
        agentsDir,
        workflowsDir
      }
    });

    const firstTick = await scheduler.tick();
    expect(firstTick.launches).toHaveLength(1);
    expect(firstTick.launches[0].launched).toBe(true);
    expect(typeof firstTick.launches[0].runId).toBe('string');

    const secondTick = await scheduler.tick();
    expect(secondTick.launches).toHaveLength(0);
    expect(secondTick.evaluations[0].dueDecision).toBe('already_launched_for_slot');

    const missionService = createMissionService({
      rootDir: missionJournalRoot,
      missionsDir,
      teamsDir,
      agentsDir,
      workflowsDir
    });

    const inspected = missionService.inspectMission({ missionId: 'scheduler-lite-mission' });
    expect(inspected.workflowRuns).toHaveLength(1);
    expect(inspected.workflowRuns[0].runId).toBe(firstTick.launches[0].runId);
  });

  it('T-INT2 no-op path when nothing is due', async () => {
    writeScheduleRegistry({ missionId: 'scheduler-lite-mission' });

    const scheduler = createSchedulerService({
      registryPath: scheduleRegistryPath,
      rootDir: schedulerJournalRoot,
      now: () => new Date('2026-03-10T12:30:00.000Z'),
      missionServiceOptions: {
        rootDir: missionJournalRoot,
        missionsDir,
        teamsDir,
        agentsDir,
        workflowsDir
      }
    });

    const result = await scheduler.tick();
    expect(result.launches).toEqual([]);
    expect(result.evaluations[0].dueDecision).toBe('not_due');
  });

  it('T-INT3 launch failure is recorded and slot remains consumed', async () => {
    writeScheduleRegistry({ missionId: 'missing-mission' });

    const scheduler = createSchedulerService({
      registryPath: scheduleRegistryPath,
      rootDir: schedulerJournalRoot,
      now: () => new Date('2026-03-10T13:05:00.000Z'),
      missionServiceOptions: {
        rootDir: missionJournalRoot,
        missionsDir,
        teamsDir,
        agentsDir,
        workflowsDir
      }
    });

    const firstTick = await scheduler.tick();
    expect(firstTick.launches).toHaveLength(1);
    expect(firstTick.launches[0].launched).toBe(false);
    expect(firstTick.launches[0].launchError).toContain('Mission definition not found');

    const secondTick = await scheduler.tick();
    expect(secondTick.launches).toHaveLength(0);
    expect(secondTick.evaluations[0].dueDecision).toBe('already_launched_for_slot');
  });

  it('T-INT4 manual mission execution remains unchanged', async () => {
    writeScheduleRegistry({ missionId: 'scheduler-lite-mission' });

    const missionService = createMissionService({
      rootDir: missionJournalRoot,
      missionsDir,
      teamsDir,
      agentsDir,
      workflowsDir
    });

    const launched = await missionService.startMission({
      missionId: 'scheduler-lite-mission',
      params: { market: 'us' }
    });

    expect(launched.missionId).toBe('scheduler-lite-mission');
    expect(typeof launched.workflowRun).toBe('string');

    const inspected = missionService.inspectMission({ missionId: 'scheduler-lite-mission' });
    expect(inspected.workflowRuns).toHaveLength(1);
  });
});
