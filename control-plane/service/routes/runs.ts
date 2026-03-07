import type { RunHandlers } from '../handlers/run-handlers.ts';
import type { RouteDefinition } from '../app.ts';

export function runRoutes(handlers: RunHandlers): RouteDefinition[] {
  return [
    {
      method: 'GET',
      path: '/runs',
      handle: async () => handlers.listRuns()
    },
    {
      method: 'GET',
      path: '/runs/:runId',
      handle: async ({ params }) => handlers.getRun(params.runId)
    },
    {
      method: 'GET',
      path: '/runs/:runId/trace',
      handle: async ({ params }) => handlers.getRunTrace(params.runId)
    },
    {
      method: 'GET',
      path: '/runs/:runId/failures',
      handle: async ({ params }) => handlers.getRunFailures(params.runId)
    },
    {
      method: 'GET',
      path: '/runs/:runId/nodes/:nodeId',
      handle: async ({ params }) => handlers.getRunNode(params.runId, params.nodeId)
    },
    {
      method: 'POST',
      path: '/runs/:runId/retry',
      handle: async ({ params, body }) => handlers.retryRun(params.runId, (body?.nodeId ?? '') as string)
    },
    {
      method: 'POST',
      path: '/runs/:runId/resume',
      handle: async ({ params }) => handlers.resumeRun(params.runId)
    },
    {
      method: 'POST',
      path: '/runs/:runId/cancel',
      handle: async ({ params }) => handlers.cancelRun(params.runId)
    }
  ];
}
