import { WorkflowDag } from './workflow-dag.ts';
import type { ValidatedWorkflowDefinition, WorkflowNodeExecutionResult, WorkflowRunResult } from './workflow-types.ts';
import type { SwarmRunner } from '../swarm/swarm-runner.ts';
import { DEFAULT_RETRY_POLICY, evaluateRetryPolicy, type RetryFailureCode, type RetryPolicy } from '../runtime/retry-policy.ts';
import { DEFAULT_TIMEOUT_POLICY, evaluateWorkflowTimeout, type TimeoutPolicy } from '../runtime/timeout-policy.ts';
import {
  collectReadyRetries,
  scheduleRetry,
  type RetryQueueItem
} from '../runtime/retry-scheduler.ts';

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

export interface WorkflowRuntimeHardeningOptions {
  retryPolicy?: RetryPolicy;
  timeoutPolicy?: TimeoutPolicy;
  onRuntimeEvent?: (event: {
    type:
      | 'NODE_RETRY_SCHEDULED'
      | 'NODE_RETRY_STARTED'
      | 'NODE_RETRY_EXHAUSTED'
      | 'NODE_TIMEOUT'
      | 'ADAPTER_TIMEOUT'
      | 'WORKFLOW_TIMEOUT';
    nodeId?: string;
    retryAttempt?: number;
    tickDelay?: number;
    failureCode?: RetryFailureCode;
  }) => void;
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

function classifyRetryFailureCode(reason: string): RetryFailureCode {
  if (reason.includes('NODE_TIMEOUT')) {
    return 'NODE_TIMEOUT';
  }
  if (reason.includes('ADAPTER_TIMEOUT')) {
    return 'ADAPTER_TIMEOUT';
  }
  if (reason.includes('WORKFLOW_TIMEOUT')) {
    return 'WORKFLOW_TIMEOUT';
  }
  if (reason.includes('TASK_RESULT_INVALID')) {
    return 'TASK_RESULT_INVALID';
  }
  if (reason.includes('TOOL_TIMEOUT')) {
    return 'TOOL_TIMEOUT';
  }
  return 'ADAPTER_EXECUTION_FAILED';
}

export async function runWorkflowWithHardening(input: {
  missionId: string;
  workflow: ValidatedWorkflowDefinition;
  executor: WorkflowTaskExecutor;
  hardening?: WorkflowRuntimeHardeningOptions;
}): Promise<WorkflowRunResult> {
  const hardening = input.hardening ?? {};
  const retryPolicy = hardening.retryPolicy ?? DEFAULT_RETRY_POLICY;
  const timeoutPolicy = hardening.timeoutPolicy ?? DEFAULT_TIMEOUT_POLICY;
  const dag = new WorkflowDag(input.workflow);
  const completedNodeIds: string[] = [];
  const outputsByNodeId: Record<string, unknown> = {};
  const nodeResults: WorkflowNodeExecutionResult[] = [];
  const retriesByNodeId: Record<string, number> = {};
  let retryQueue: RetryQueueItem[] = [];
  let tick = 0;

  while (!dag.isComplete(completedNodeIds)) {
    tick += 1;
    const workflowTimeout = evaluateWorkflowTimeout(tick, timeoutPolicy);
    if (workflowTimeout.timedOut) {
      hardening.onRuntimeEvent?.({
        type: 'WORKFLOW_TIMEOUT',
        failureCode: 'WORKFLOW_TIMEOUT'
      });
      throw new Error(`workflow.timeout: workflowId=${input.workflow.workflowId}`);
    }

    const readyRetries = collectReadyRetries({
      queue: retryQueue,
      currentTick: tick,
      workflow: input.workflow,
      completedNodeIds
    });
    const retryNode = readyRetries[0];
    if (retryNode) {
      retryQueue = retryQueue.filter((item) => !(item.nodeId === retryNode.nodeId && item.retryAttempt === retryNode.retryAttempt));
      hardening.onRuntimeEvent?.({
        type: 'NODE_RETRY_STARTED',
        nodeId: retryNode.nodeId,
        retryAttempt: retryNode.retryAttempt
      });
    }

    const runnableNodes = dag.getRunnableNodes(completedNodeIds);
    if (runnableNodes.length === 0 && !retryNode) {
      throw new Error(`workflow.execution_stalled: workflowId=${input.workflow.workflowId}`);
    }

    const nextNode = retryNode
      ? dag.getRunnableNodes(completedNodeIds).find((node) => node.id === retryNode.nodeId)
      : runnableNodes[0];
    if (!nextNode) {
      continue;
    }

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
      if (!completedNodeIds.includes(nextNode.id)) {
        completedNodeIds.push(nextNode.id);
      }
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
      const failureCode = classifyRetryFailureCode(reason);
      if (failureCode === 'NODE_TIMEOUT') {
        hardening.onRuntimeEvent?.({ type: 'NODE_TIMEOUT', nodeId: nextNode.id, failureCode });
      } else if (failureCode === 'ADAPTER_TIMEOUT') {
        hardening.onRuntimeEvent?.({ type: 'ADAPTER_TIMEOUT', nodeId: nextNode.id, failureCode });
      }

      const previousRetryCount = retriesByNodeId[nextNode.id] ?? 0;
      const retryDecision = evaluateRetryPolicy({
        policy: retryPolicy,
        failureCode,
        previousRetryCount
      });

      if (retryDecision.eligible) {
        retriesByNodeId[nextNode.id] = retryDecision.retryAttempt;
        retryQueue = scheduleRetry({
          queue: retryQueue,
          runId: 'workflow-runtime',
          workflowId: input.workflow.workflowId,
          nodeId: nextNode.id,
          retryAttempt: retryDecision.retryAttempt,
          currentTick: tick,
          tickDelay: retryDecision.tickDelay
        });
        hardening.onRuntimeEvent?.({
          type: 'NODE_RETRY_SCHEDULED',
          nodeId: nextNode.id,
          retryAttempt: retryDecision.retryAttempt,
          tickDelay: retryDecision.tickDelay,
          failureCode
        });
        continue;
      }

      if (retryDecision.reason === 'RETRY_EXHAUSTED') {
        hardening.onRuntimeEvent?.({
          type: 'NODE_RETRY_EXHAUSTED',
          nodeId: nextNode.id,
          retryAttempt: retryDecision.retryAttempt,
          failureCode
        });
      }

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
