import type { RuntimeService } from '../../operator/runtime-service.ts';
import type { WorkflowService } from '../../operator/workflow-service.ts';

export interface RunHandlers {
  listRuns: () => unknown;
  getRun: (runId: string) => unknown;
  getRunTrace: (runId: string) => unknown;
  getRunFailures: (runId: string) => unknown;
  getRunNode: (runId: string, nodeId: string) => unknown;
  retryRun: (runId: string, nodeId: string) => Promise<unknown>;
  resumeRun: (runId: string) => Promise<unknown>;
  cancelRun: (runId: string) => unknown;
}

function assertNodeId(nodeId: string | undefined): string {
  if (!nodeId || nodeId.trim().length === 0) {
    throw {
      code: 'RUN_NODE_ID_INVALID',
      message: 'nodeId is required'
    };
  }

  return nodeId;
}

export function createRunHandlers(workflowService: WorkflowService, runtimeService: RuntimeService): RunHandlers {
  function getRun(runId: string): unknown {
    return workflowService.inspectWorkflow({ runId });
  }

  function getRunTrace(runId: string): unknown {
    return workflowService.traceWorkflow({ runId });
  }

  function getRunFailures(runId: string): unknown {
    const trace = workflowService.traceWorkflow({ runId }) as {
      failures?: unknown[];
    };

    return {
      runId,
      failures: trace.failures ?? []
    };
  }

  function getRunNode(runId: string, nodeId: string): unknown {
    const run = workflowService.inspectWorkflow({ runId }) as {
      nodeStates?: Array<Record<string, unknown>>;
    };

    const node = (run.nodeStates ?? []).find((entry) => entry.nodeId === nodeId);
    if (!node) {
      throw {
        code: 'RUN_NODE_NOT_FOUND',
        message: `Node not found for run: ${nodeId}`,
        statusCode: 404
      };
    }

    return node;
  }

  return {
    listRuns: () => workflowService.listWorkflows(),
    getRun,
    getRunTrace,
    getRunFailures,
    getRunNode,
    retryRun: async (runId, nodeId) => runtimeService.retryWorkflowNode({ runId, nodeId: assertNodeId(nodeId) }),
    resumeRun: async (runId) => runtimeService.resumeWorkflow({ runId }),
    cancelRun: (runId) => runtimeService.cancelWorkflow({ runId })
  };
}
