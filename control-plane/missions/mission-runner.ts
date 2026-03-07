import { loadAgentProfilesFromDir } from '../agents/agent-profile-loader.ts';
import type { AgentProfileDefinition } from '../agents/agent-profile-types.ts';
import { createExecutionJournal, type ExecutionJournal } from '../journal/journal.ts';
import { createSwarmRunner, type SwarmRunner } from '../swarm/swarm-runner.ts';
import { loadTeamDefinitionById } from '../teams/team-loader.ts';
import type { TeamDefinition } from '../teams/team-types.ts';
import { loadMissionDefinitionById } from './mission-loader.ts';
import type { MissionDefinition, MissionExecutionSeed, MissionRunResult } from './mission-types.ts';

type MissionRunnerOptions = {
  missionsDir?: string;
  teamsDir?: string;
  agentsDir?: string;
  journal?: ExecutionJournal;
  swarmRunner?: SwarmRunner;
};

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function resolveAgentRoster(team: TeamDefinition, profiles: AgentProfileDefinition[]): string[] {
  const profileMap = new Map(profiles.map((profile) => [profile.agentId, profile]));
  const missing = team.members.filter((member) => !profileMap.has(member));
  if (missing.length > 0) {
    throw new Error(`Team ${team.teamId} references unknown agent profiles: ${sortedUnique(missing).join(', ')}.`);
  }

  return sortedUnique(team.members);
}

function validateMissionTeamCoherence(mission: MissionDefinition, team: TeamDefinition): void {
  if (mission.teamId !== team.teamId) {
    throw new Error(`Mission ${mission.missionId} references mismatched teamId ${mission.teamId}.`);
  }
  if (mission.projectId !== team.projectId) {
    throw new Error(
      `Mission ${mission.missionId} projectId ${mission.projectId} does not match team ${team.teamId} projectId ${team.projectId}.`
    );
  }
}

function toExecutionSeed(mission: MissionDefinition, roster: string[]): MissionExecutionSeed {
  return {
    missionId: mission.missionId,
    teamId: mission.teamId,
    agentRoster: sortedUnique(roster)
  };
}

export function createMissionRunner(options: MissionRunnerOptions = {}) {
  const journal = options.journal ?? createExecutionJournal();
  const swarmRunner = options.swarmRunner ?? createSwarmRunner({ journal });

  function loadMissionBundle(missionId: string): {
    mission: MissionDefinition;
    team: TeamDefinition;
    profiles: AgentProfileDefinition[];
    executionSeed: MissionExecutionSeed;
  } {
    const profiles = loadAgentProfilesFromDir(options.agentsDir);
    const mission = loadMissionDefinitionById(missionId, options.missionsDir);
    const team = loadTeamDefinitionById(mission.teamId, options.teamsDir, profiles);

    validateMissionTeamCoherence(mission, team);
    const agentRoster = resolveAgentRoster(team, profiles);

    return {
      mission,
      team,
      profiles,
      executionSeed: toExecutionSeed(mission, agentRoster)
    };
  }

  async function runMission(missionId: string): Promise<MissionRunResult> {
    const loaded = loadMissionBundle(missionId);

    const created = swarmRunner.createSwarmRun({
      projectId: loaded.mission.projectId,
      kind: 'mission',
      entrypoint: `mission:${loaded.mission.missionId}`,
      missionId: loaded.mission.missionId,
      teamId: loaded.executionSeed.teamId,
      initialMemory: loaded.mission.initialContext,
      metadata: {
        missionId: loaded.executionSeed.missionId,
        teamId: loaded.executionSeed.teamId,
        workflowId: loaded.mission.workflowId,
        agentRoster: loaded.executionSeed.agentRoster,
        missionLifecycleEvents: ['MISSION_STARTED', 'TEAM_ASSIGNED']
      }
    });

    const completed = await swarmRunner.executeSwarmRun({ runId: created.runId });

    return {
      mission: loaded.mission,
      teamId: loaded.team.teamId,
      workflowId: loaded.mission.workflowId,
      agentRoster: loaded.executionSeed.agentRoster,
      runSummary: {
        runId: completed.runId,
        status: completed.status,
        currentPhase: completed.currentPhase,
        completedPhases: completed.completedPhases,
        eventCount: completed.eventCount
      }
    };
  }

  function inspectMission(missionId: string): {
    mission: MissionDefinition;
    workflowId: string;
    team: TeamDefinition;
    agentRoster: AgentProfileDefinition[];
    initialContext: Record<string, unknown>;
    executionSeed: MissionExecutionSeed;
  } {
    const loaded = loadMissionBundle(missionId);
    const profileMap = new Map(loaded.profiles.map((profile) => [profile.agentId, profile]));

    return {
      mission: loaded.mission,
      workflowId: loaded.mission.workflowId,
      team: loaded.team,
      agentRoster: loaded.executionSeed.agentRoster
        .map((agentId) => profileMap.get(agentId))
        .filter((profile): profile is AgentProfileDefinition => profile !== undefined),
      initialContext: loaded.mission.initialContext,
      executionSeed: loaded.executionSeed
    };
  }

  return {
    runMission,
    inspectMission
  };
}

export type MissionRunner = ReturnType<typeof createMissionRunner>;
