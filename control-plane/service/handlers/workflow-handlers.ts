import { loadWorkflowDefinitionById } from '../../workflows/workflow-loader.ts';
import type { WorkflowService } from '../../operator/workflow-service.ts';

export interface WorkflowHandlers {
  listWorkflows: () => unknown;
  getWorkflow: (workflowId: string) => unknown;
  inspectWorkflow: (workflowId: string) => unknown;
}

export function createWorkflowHandlers(service: WorkflowService): WorkflowHandlers {
  function getWorkflow(workflowId: string): unknown {
    return loadWorkflowDefinitionById(workflowId);
  }

  function inspectWorkflow(workflowId: string): unknown {
    const definition = loadWorkflowDefinitionById(workflowId);
    const runs = service.listWorkflows() as Array<Record<string, unknown>>;
    const relatedRuns = runs.filter((entry) => entry.workflowId === workflowId);

    return {
      workflowId,
      definition,
      runs: relatedRuns
    };
  }

  return {
    listWorkflows: () => service.listWorkflows(),
    getWorkflow,
    inspectWorkflow
  };
}
