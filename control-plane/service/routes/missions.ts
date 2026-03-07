import type { MissionHandlers } from '../handlers/mission-handlers.ts';
import type { RouteDefinition } from '../app.ts';

export function missionRoutes(handlers: MissionHandlers): RouteDefinition[] {
  return [
    {
      method: 'GET',
      path: '/missions',
      handle: async () => handlers.listMissions()
    },
    {
      method: 'GET',
      path: '/missions/:missionId',
      handle: async ({ params }) => handlers.getMission(params.missionId)
    },
    {
      method: 'POST',
      path: '/missions/:missionId/start',
      successStatusCode: 201,
      handle: async ({ params, body }) => handlers.startMission(params.missionId, (body?.params ?? {}) as Record<string, string>)
    },
    {
      method: 'POST',
      path: '/missions/:missionId/cancel',
      handle: async ({ params }) => handlers.cancelMission(params.missionId)
    },
    {
      method: 'GET',
      path: '/missions/:missionId/agents',
      handle: async ({ params }) => handlers.getMissionAgents(params.missionId)
    },
    {
      method: 'GET',
      path: '/teams/:teamId',
      handle: async ({ params }) => handlers.getTeam(params.teamId)
    }
  ];
}
