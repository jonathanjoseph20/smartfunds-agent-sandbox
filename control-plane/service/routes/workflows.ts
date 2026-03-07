import type { WorkflowHandlers } from '../handlers/workflow-handlers.ts';
import type { RouteDefinition } from '../app.ts';

export function workflowRoutes(handlers: WorkflowHandlers): RouteDefinition[] {
  return [
    {
      method: 'GET',
      path: '/workflows',
      handle: async () => handlers.listWorkflows()
    },
    {
      method: 'GET',
      path: '/workflows/:workflowId',
      handle: async ({ params }) => handlers.getWorkflow(params.workflowId)
    },
    {
      method: 'GET',
      path: '/workflows/:workflowId/inspect',
      handle: async ({ params }) => handlers.inspectWorkflow(params.workflowId)
    }
  ];
}
