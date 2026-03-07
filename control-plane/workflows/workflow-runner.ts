import { WorkflowDag } from './workflow-dag.ts';
import type { ValidatedWorkflowDefinition, WorkflowNodeExecutionResult, WorkflowRunResult } from './workflow-types.ts';
import type { SwarmRunner } from '../swarm/swarm-runner.ts';

export interface WorkflowTaskExecutor {
  execute(input: {
    missionId: string;
    workflowId: string;
    workflowNodeId: string;
    task: string;
    agent?: string;
    previousOutputs: Record<string, unknown>;
  }): Promise<unknown> | unknown;
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function buildPreviousOutputs(
  allOutputs: Record<string, unknown>,
  dependencyNodeIds: string[]
): Record<string, unknown> {
  const dependencies = sortedUnique(dependencyNodeIds);
  const entries = dependencies
    .filter((dependency) => Object.prototype.hasOwnProperty.call(allOutputs, dependency))
    .map((dependency) => [dependency, allOutputs[dependency]] as const);

  return Object.fromEntries(entries);
}

export async function runWorkflow(input: {
  missionId: string;
  workflow: ValidatedWorkflowDefinition;
  executor: WorkflowTaskExecutor;
}): Promise<WorkflowRunResult> {
  const dag = new WorkflowDag(input.workflow);
  const completedNodeIds: string[] = [];
  const outputsByNodeId: Record<string, unknown> = {};
  const nodeResults: WorkflowNodeExecutionResult[] = [];

  while (!dag.isComplete(completedNodeIds)) {
    const runnableNodes = dag.getRunnableNodes(completedNodeIds);

    if (runnableNodes.length === 0) {
      throw new Error(`workflow.execution_stalled: workflowId=${input.workflow.workflowId}`);
    }

    const nextNode = runnableNodes[0];
    const previousOutputs = buildPreviousOutputs(outputsByNodeId, nextNode.dependsOn);

    try {
      const output = await input.executor.execute({
        missionId: input.missionId,
        workflowId: input.workflow.workflowId,
        workflowNodeId: nextNode.id,
        task: nextNode.task,
        ...(nextNode.agent ? { agent: nextNode.agent } : {}),
        previousOutputs
      });

      outputsByNodeId[nextNode.id] = output;
      completedNodeIds.push(nextNode.id);
      completedNodeIds.sort((left, right) => left.localeCompare(right));

      nodeResults.push({
        workflowNodeId: nextNode.id,
        task: nextNode.task,
        ...(nextNode.agent ? { agentId: nextNode.agent } : {}),
        output
      });
    } catch (error) {
      const reason = error instanceof Error && error.message.trim().length > 0
        ? error.message
        : 'workflow_node_execution_failed';
      throw new Error(
        `workflow.execution_failed: workflowId=${input.workflow.workflowId} workflowNodeId=${nextNode.id} reason=${reason}`
      );
    }
  }

  return {
    missionId: input.missionId,
    workflowId: input.workflow.workflowId,
    executionOrder: nodeResults.map((result) => result.workflowNodeId),
    nodeResults
  };
}

export function createSwarmWorkflowExecutor(input: {
  swarmRunner: SwarmRunner;
  projectId: string;
}): WorkflowTaskExecutor {
  return {
    async execute(params) {
      const created = input.swarmRunner.createSwarmRun({
        projectId: input.projectId,
        kind: 'mission',
        entrypoint: `workflow:${params.workflowId}:${params.workflowNodeId}`,
        missionId: params.missionId,
        initialMemory: {
          workflowNodeId: params.workflowNodeId,
          task: params.task,
          previousOutputs: params.previousOutputs
        },
        metadata: {
          missionId: params.missionId,
          workflowId: params.workflowId,
          workflowNodeId: params.workflowNodeId,
          task: params.task,
          ...(params.agent ? { agentId: params.agent } : {}),
          adapterId: params.task
        }
      });

      const completed = await input.swarmRunner.executeSwarmRun({ runId: created.runId });

      return {
        runId: completed.runId,
        status: completed.status,
        currentPhase: completed.currentPhase,
        completedPhases: completed.completedPhases,
        eventCount: completed.eventCount
      };
    }
  };
}
