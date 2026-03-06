import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createExecutionJournal } from '../journal/journal.ts';
import { createSwarmRunner } from '../swarm/swarm-runner.ts';
import { createMissionRunner } from './mission-runner.ts';
import type { SwarmRunner } from '../swarm/swarm-runner.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-runner');
const missionsDir = path.join(tmpRoot, 'missions');
const teamsDir = path.join(tmpRoot, 'teams');
const agentsDir = path.join(tmpRoot, 'agents');

function resetTmpDir(): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(missionsDir, { recursive: true });
  fs.mkdirSync(teamsDir, { recursive: true });
  fs.mkdirSync(agentsDir, { recursive: true });
}

function writeJson(dir: string, fileName: string, value: unknown): void {
  fs.writeFileSync(path.join(dir, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeFixtures(): void {
  writeJson(missionsDir, 'rwa-market-analysis.json', {
    missionId: 'rwa-market-analysis',
    name: 'RWA Market Opportunity Analysis',
    projectId: 'smartfunds-core',
    teamId: 'smartfunds-research-team',
    workflowId: 'research-analysis-workflow',
    objective: 'Analyze near-term tokenized RWA opportunities.',
    successCriteria: ['Produce market landscape summary'],
    deliverables: ['market-summary'],
    initialContext: {
      sector: 'RWA',
      targetAssets: ['commodities', 'private equity', 'credit']
    }
  });

  writeJson(teamsDir, 'smartfunds-research-team.json', {
    teamId: 'smartfunds-research-team',
    name: 'SmartFunds Research Team',
    projectId: 'smartfunds-core',
    members: ['lead-thesis-architect', 'macro-signal-analyst', 'compliance-risk-reviewer'],
    executionMode: 'structured'
  });

  const profiles = [
    'lead-thesis-architect',
    'macro-signal-analyst',
    'compliance-risk-reviewer'
  ];

  for (const agentId of profiles) {
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
        allowedAdapters: ['llm'],
        preferredTools: ['llm'],
        forbiddenTools: ['repo', 'shell']
      }
    });
  }
}

beforeEach(() => {
  resetTmpDir();
  writeFixtures();
});

describe('mission-runner', () => {
  it('T-M7 loads mission -> team -> agents and invokes swarm runner', async () => {
    const createSwarmRun = vi.fn(() => ({ runId: 'run_smartfunds-core_0001' }));
    const executeSwarmRun = vi.fn(async () => ({
      runId: 'run_smartfunds-core_0001',
      status: 'completed',
      currentPhase: 'release',
      completedPhases: ['plan', 'setup', 'implement', 'verify', 'test', 'release'],
      eventCount: 27
    }));

    const runner = createMissionRunner({
      missionsDir,
      teamsDir,
      agentsDir,
      swarmRunner: {
        createSwarmRun,
        executeSwarmRun,
        getSwarmRunStatus: vi.fn()
      } as unknown as SwarmRunner
    });

    const result = await runner.runMission('rwa-market-analysis');

    expect(result.mission.missionId).toBe('rwa-market-analysis');
    expect(result.teamId).toBe('smartfunds-research-team');
    expect(result.agentRoster).toEqual([
      'compliance-risk-reviewer',
      'lead-thesis-architect',
      'macro-signal-analyst'
    ]);

    expect(createSwarmRun).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'smartfunds-core',
      kind: 'mission',
      entrypoint: 'mission:rwa-market-analysis',
      missionId: 'rwa-market-analysis',
      metadata: expect.objectContaining({
        missionId: 'rwa-market-analysis',
        teamId: 'smartfunds-research-team',
        workflowId: 'research-analysis-workflow',
        agentRoster: ['compliance-risk-reviewer', 'lead-thesis-architect', 'macro-signal-analyst']
      }),
      initialMemory: {
        sector: 'RWA',
        targetAssets: ['commodities', 'private equity', 'credit']
      }
    }));

    expect(executeSwarmRun).toHaveBeenCalledWith({ runId: 'run_smartfunds-core_0001' });
  });

  it('T-M8 exposes deterministic mission inspection bundle', () => {
    const runner = createMissionRunner({
      missionsDir,
      teamsDir,
      agentsDir,
      swarmRunner: {
        createSwarmRun: vi.fn(),
        executeSwarmRun: vi.fn(),
        getSwarmRunStatus: vi.fn()
      } as unknown as SwarmRunner
    });

    const inspected = runner.inspectMission('rwa-market-analysis');

    expect(inspected.executionSeed).toEqual({
      missionId: 'rwa-market-analysis',
      teamId: 'smartfunds-research-team',
      agentRoster: ['compliance-risk-reviewer', 'lead-thesis-architect', 'macro-signal-analyst']
    });
    expect(inspected.agentRoster).toHaveLength(3);
  });

  it('T-M9 seeds mission/team/agent metadata into execution context snapshots', async () => {
    const journal = createExecutionJournal({ rootDir: tmpRoot });
    const swarmRunner = createSwarmRunner({ journal });
    const runner = createMissionRunner({
      missionsDir,
      teamsDir,
      agentsDir,
      journal,
      swarmRunner
    });

    const result = await runner.runMission('rwa-market-analysis');
    const inspected = journal.inspectRun(result.runSummary.runId);

    const createdEvent = inspected.events.find((event) => event.type === 'RUN_CREATED');
    expect(createdEvent?.payload).toMatchObject({
      missionLifecycleEvent: 'MISSION_STARTED',
      context_snapshot: {
        missionId: 'rwa-market-analysis',
        metadata: {
          missionId: 'rwa-market-analysis',
          teamId: 'smartfunds-research-team',
          workflowId: 'research-analysis-workflow',
          agentRoster: ['compliance-risk-reviewer', 'lead-thesis-architect', 'macro-signal-analyst'],
          missionLifecycleEvents: ['MISSION_STARTED', 'TEAM_ASSIGNED']
        }
      }
    });
  });
});
