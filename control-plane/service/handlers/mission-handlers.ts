import { loadAgentProfilesFromDir, indexAgentProfilesById } from '../../agents/agent-profile-loader.ts';
import { loadMissionDefinitionById } from '../../missions/mission-loader.ts';
import type { MissionService } from '../../operator/mission-service.ts';
import { loadTeamDefinitionById } from '../../teams/team-loader.ts';

export interface MissionHandlers {
  listMissions: () => unknown;
  getMission: (missionId: string) => unknown;
  startMission: (missionId: string, params: Record<string, string>) => Promise<unknown>;
  cancelMission: (missionId: string) => unknown;
  getTeam: (teamId: string) => unknown;
  getMissionAgents: (missionId: string) => unknown;
}

export function createMissionHandlers(service: MissionService): MissionHandlers {
  function getTeam(teamId: string): unknown {
    const profiles = loadAgentProfilesFromDir();
    const profileById = indexAgentProfilesById(profiles);
    const team = loadTeamDefinitionById(teamId, undefined, profiles);

    const agents = team.members
      .map((agentId) => {
        const profile = profileById.get(agentId);
        if (!profile) {
          return null;
        }

        return {
          agentId: profile.agentId,
          role: profile.role,
          profile: profile.profile
        };
      })
      .filter((value): value is { agentId: string; role: string; profile: string } => value !== null);

    return {
      teamId: team.teamId,
      projectId: team.projectId,
      executionMode: team.executionMode,
      agents
    };
  }

  function getMissionAgents(missionId: string): unknown {
    const mission = loadMissionDefinitionById(missionId);
    return getTeam(mission.teamId);
  }

  return {
    listMissions: () => service.listMissions(),
    getMission: (missionId) => service.inspectMission({ missionId }),
    startMission: (missionId, params) => service.startMission({ missionId, params }),
    cancelMission: (missionId) => service.cancelMission({ missionId }),
    getTeam,
    getMissionAgents
  };
}
