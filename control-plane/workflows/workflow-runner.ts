import { WorkflowDag } from './workflow-dag.ts';
import type { ValidatedWorkflowDefinition, WorkflowNodeExecutionResult, WorkflowRunResult } from './workflow-types.ts';
import type { SwarmRunner } from '../swarm/swarm-runner.ts';
import { fetchPage, searchTwitter, searchWeb } from '../../packages/tool-adapters/dist/index.js';
import { createLlmGateway } from '../../packages/llm-gateway/dist/index.js';
import { DEFAULT_RETRY_POLICY, evaluateRetryPolicy, type RetryFailureCode, type RetryPolicy } from '../runtime/retry-policy.ts';
import {
  DEFAULT_TIMEOUT_POLICY,
  evaluateAdapterTimeout,
  evaluateNodeTimeout,
  evaluateWorkflowTimeout,
  type TimeoutPolicy
} from '../runtime/timeout-policy.ts';
import {
  DEFAULT_RUNTIME_SAFETY_LIMITS,
  evaluateRuntimeSafetyLimits,
  type RuntimeSafetyLimits
} from '../runtime/safety-limits.ts';
import { canonicalStringify } from '../finance/determinism.ts';
import {
  collectReadyRetries,
  sortRetryQueue,
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
    missionContextMemory?: Record<string, unknown>;
  }): Promise<unknown> | unknown;
}

export interface WorkflowRuntimeHardeningOptions {
  retryPolicy?: RetryPolicy;
  timeoutPolicy?: TimeoutPolicy;
  safetyLimits?: RuntimeSafetyLimits;
  initialState?: {
    completedNodeIds?: string[];
    outputsByNodeId?: Record<string, unknown>;
    retriesByNodeId?: Record<string, number>;
    retryQueue?: Array<{
      nodeId: string;
      retryAttempt: number;
      scheduledTick: number;
    }>;
    currentTick?: number;
  };
  resolveElapsedSeconds?: (input: {
    kind: 'workflow' | 'node' | 'adapter';
    tick: number;
    nodeId?: string;
    reason?: string;
    retryAttempt?: number;
  }) => number;
  onNodeEvent?: (event: {
    type: 'TASK_STARTED' | 'TASK_COMPLETED' | 'TASK_FAILED';
    nodeId: string;
    task: string;
    agentId: string | null;
    previousOutputs: Record<string, unknown>;
    output?: unknown;
    reason?: string;
    failureCode?: RetryFailureCode;
    retryAttempt: number;
  }) => void;
  onRuntimeEvent?: (event: {
    type:
      | 'NODE_RETRY_SCHEDULED'
      | 'NODE_RETRY_STARTED'
      | 'NODE_RETRY_EXHAUSTED'
      | 'NODE_TIMEOUT'
      | 'ADAPTER_TIMEOUT'
      | 'WORKFLOW_TIMEOUT'
      | 'SAFETY_LIMIT_VIOLATION';
    nodeId?: string;
    retryAttempt?: number;
    tickDelay?: number;
    failureCode?: RetryFailureCode;
    safetyCode?: string;
    safetyMessage?: string;
    safetyActual?: number;
    safetyLimit?: number;
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

function resolveLiveFlag(missionContextMemory: Record<string, unknown> | undefined): boolean {
  const parameters = missionContextMemory?.missionParameters;
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    return false;
  }
  const live = (parameters as Record<string, unknown>).live;
  return live === '1' || live === 'true';
}

async function executeToolOrLlmTask(params: {
  task: string;
  previousOutputs: Record<string, unknown>;
  missionContextMemory?: Record<string, unknown>;
  workflowNodeId: string;
}): Promise<unknown> {
  const live = resolveLiveFlag(params.missionContextMemory);

  if (params.task === 'web_search') {
    const query = typeof params.previousOutputs.query === 'string'
      ? params.previousOutputs.query
      : 'rwa tokenization market';
    const endpoint = 'https://duckduckgo.com/html/';
    const result = live
      ? await searchWeb({
        query,
        limit: 5,
        sourceClass: 'market-research'
      }).catch((error) => ({
        query,
        results: [],
        error: {
          task: 'web_search',
          endpoint,
          message: error instanceof Error ? error.message : 'fetch failed'
        }
      }))
      : {
        query,
        results: []
      };
    return {
      tool: 'web_search',
      ...result
    };
  }

  if (params.task === 'web_fetch') {
    const url = typeof params.previousOutputs.url === 'string'
      ? params.previousOutputs.url
      : 'https://example.com';
    const result = live
      ? await fetchPage({ url }).catch((error) => ({
        url,
        text: '',
        statusCode: 0,
        error: {
          task: 'web_fetch',
          endpoint: url,
          message: error instanceof Error ? error.message : 'fetch failed'
        }
      }))
      : {
        url,
        text: '',
        statusCode: 200
      };
    return {
      tool: 'web_fetch',
      ...result
    };
  }

  if (params.task === 'twitter_search') {
    const query = typeof params.previousOutputs.query === 'string'
      ? params.previousOutputs.query
      : 'rwa tokenization';
    const endpoint = 'https://duckduckgo.com/html/';
    const result = live
      ? await searchTwitter({
        query,
        limit: 5
      }).catch((error) => ({
        query,
        results: [],
        error: {
          task: 'twitter_search',
          endpoint,
          message: error instanceof Error ? error.message : 'fetch failed'
        }
      }))
      : {
        query,
        results: []
      };
    return {
      tool: 'twitter_search',
      ...result
    };
  }

  if (params.task === 'llm_synthesis') {
    if (!live) {
      return {
        mode: 'stub',
        summary: `stub:llm_synthesis:${params.workflowNodeId}`
      };
    }

    const gateway = createLlmGateway({
      auditStore: {
        write: () => {
          // Intentionally no-op for workflow node synthesis path.
        },
        getSpendSnapshot: () => ({
          globalDailySpentUsd: 0,
          globalMonthlySpentUsd: 0,
          routeDailySpentUsd: 0
        })
      }
    });
    const result = await gateway.generateStructured<Record<string, unknown>>({
      callerClass: 'workflow_node',
      routeClass: 'analysis',
      promptId: params.workflowNodeId,
      promptVersion: 'v1',
      userPrompt: JSON.stringify(params.previousOutputs),
      schema: {
        type: 'object',
        additionalProperties: true
      },
      parseMode: 'extract_json',
      repairOnFailure: true
    });

    if (!result.ok) {
      throw new Error(`LLM_SYNTHESIS_FAILED: ${result.code}`);
    }

    return {
      mode: 'gateway',
      provider: result.provider,
      modelAlias: result.modelAlias,
      value: result.value
    };
  }

  return null;
}

export async function runWorkflow(input: {
  missionId: string;
  workflow: ValidatedWorkflowDefinition;
  executor: WorkflowTaskExecutor;
  missionContextMemory?: Record<string, unknown>;
}): Promise<WorkflowRunResult> {
  return runWorkflowWithHardening(input);
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

function parseElapsedSeconds(reason: string): number | null {
  const matched = reason.match(/elapsed(?:Seconds)?=([0-9]+)/i);
  if (!matched) {
    return null;
  }

  const parsed = Number.parseInt(matched[1], 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

export async function runWorkflowWithHardening(input: {
  missionId: string;
  workflow: ValidatedWorkflowDefinition;
  executor: WorkflowTaskExecutor;
  missionContextMemory?: Record<string, unknown>;
  hardening?: WorkflowRuntimeHardeningOptions;
}): Promise<WorkflowRunResult> {
  const hardening = input.hardening ?? {};
  const retryPolicy = hardening.retryPolicy ?? DEFAULT_RETRY_POLICY;
  const timeoutPolicy = hardening.timeoutPolicy ?? DEFAULT_TIMEOUT_POLICY;
  const safetyLimits = hardening.safetyLimits ?? DEFAULT_RUNTIME_SAFETY_LIMITS;
  const resolveElapsedSeconds = hardening.resolveElapsedSeconds ?? ((params: { tick: number }) => params.tick);
  const dag = new WorkflowDag(input.workflow);
  const completedNodeIds = sortedUnique(hardening.initialState?.completedNodeIds ?? []);
  const outputsByNodeId: Record<string, unknown> = { ...(hardening.initialState?.outputsByNodeId ?? {}) };
  const nodeResults: WorkflowNodeExecutionResult[] = [];
  const retriesByNodeId: Record<string, number> = { ...(hardening.initialState?.retriesByNodeId ?? {}) };
  let retryQueue: RetryQueueItem[] = sortRetryQueue((hardening.initialState?.retryQueue ?? []).map((item) => ({
    runId: 'workflow-runtime',
    workflowId: input.workflow.workflowId,
    nodeId: item.nodeId,
    retryAttempt: item.retryAttempt,
    scheduledTick: item.scheduledTick
  })));
  let tick = Number.isInteger(hardening.initialState?.currentTick) && (hardening.initialState?.currentTick ?? 0) >= 0
    ? (hardening.initialState?.currentTick ?? 0)
    : 0;

  function assertSafetyLimits(currentTick: number): void {
    const totalRetries = Object.values(retriesByNodeId).reduce((sum, count) => sum + count, 0);
    const contextSize = canonicalStringify({
      completedNodeIds,
      outputsByNodeId,
      retriesByNodeId,
      retryQueue
    }).length;

    const violations = evaluateRuntimeSafetyLimits({
      nodeCount: input.workflow.nodes.length,
      runtimeSeconds: currentTick,
      retriesByNode: retriesByNodeId,
      totalRetries,
      contextSize,
      limits: safetyLimits
    });

    if (violations.length === 0) {
      return;
    }

    const violation = violations[0];
    hardening.onRuntimeEvent?.({
      type: 'SAFETY_LIMIT_VIOLATION',
      failureCode: 'ADAPTER_EXECUTION_FAILED',
      safetyCode: violation.code,
      safetyMessage: violation.message,
      safetyActual: violation.actual,
      safetyLimit: violation.limit
    });
    throw new Error(`workflow.safety_limit_violation: workflowId=${input.workflow.workflowId} code=${violation.code}`);
  }

  while (!dag.isComplete(completedNodeIds)) {
    tick += 1;
    assertSafetyLimits(tick);

    const workflowElapsed = resolveElapsedSeconds({
      kind: 'workflow',
      tick
    });
    const workflowTimeout = evaluateWorkflowTimeout(workflowElapsed, timeoutPolicy);
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

    const retryAttempt = retryNode?.retryAttempt ?? 0;
    hardening.onNodeEvent?.({
      type: 'TASK_STARTED',
      nodeId: nextNode.id,
      task: nextNode.task,
      agentId: nextNode.agent ?? null,
      previousOutputs,
      retryAttempt
    });

    try {
      const output = await input.executor.execute({
        missionId: input.missionId,
        workflowId: input.workflow.workflowId,
        workflowNodeId: nextNode.id,
        task: nextNode.task,
        ...(nextNode.agent ? { agent: nextNode.agent } : {}),
        previousOutputs,
        missionContextMemory: input.missionContextMemory
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
      hardening.onNodeEvent?.({
        type: 'TASK_COMPLETED',
        nodeId: nextNode.id,
        task: nextNode.task,
        agentId: nextNode.agent ?? null,
        previousOutputs,
        output,
        retryAttempt
      });
    } catch (error) {
      const reason = error instanceof Error && error.message.trim().length > 0
        ? error.message
        : 'workflow_node_execution_failed';
      const inferred = classifyRetryFailureCode(reason);
      const parsedElapsed = parseElapsedSeconds(reason);
      const nextRetryAttempt = (retriesByNodeId[nextNode.id] ?? 0) + 1;
      const nodeElapsed = resolveElapsedSeconds({
        kind: 'node',
        tick,
        nodeId: nextNode.id,
        reason,
        retryAttempt: nextRetryAttempt
      });
      const adapterElapsed = resolveElapsedSeconds({
        kind: 'adapter',
        tick,
        nodeId: nextNode.id,
        reason,
        retryAttempt: nextRetryAttempt
      });
      const nodeTimeout = evaluateNodeTimeout(parsedElapsed ?? nodeElapsed, timeoutPolicy);
      const adapterTimeout = evaluateAdapterTimeout(parsedElapsed ?? adapterElapsed, timeoutPolicy);

      const failureCode: RetryFailureCode = inferred === 'NODE_TIMEOUT' || nodeTimeout.timedOut
        ? 'NODE_TIMEOUT'
        : inferred === 'ADAPTER_TIMEOUT' || adapterTimeout.timedOut
          ? 'ADAPTER_TIMEOUT'
          : inferred;
      if (failureCode === 'NODE_TIMEOUT') {
        hardening.onRuntimeEvent?.({ type: 'NODE_TIMEOUT', nodeId: nextNode.id, failureCode });
      } else if (failureCode === 'ADAPTER_TIMEOUT') {
        hardening.onRuntimeEvent?.({ type: 'ADAPTER_TIMEOUT', nodeId: nextNode.id, failureCode });
      }
      hardening.onNodeEvent?.({
        type: 'TASK_FAILED',
        nodeId: nextNode.id,
        task: nextNode.task,
        agentId: nextNode.agent ?? null,
        previousOutputs,
        reason,
        failureCode,
        retryAttempt
      });

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
        assertSafetyLimits(tick);
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
  missionMemory?: Record<string, unknown>;
}): WorkflowTaskExecutor {
  return {
    async execute(params) {
      const direct = await executeToolOrLlmTask({
        task: params.task,
        previousOutputs: params.previousOutputs,
        missionContextMemory: params.missionContextMemory,
        workflowNodeId: params.workflowNodeId
      });

      if (direct !== null) {
        return direct;
      }

      const created = input.swarmRunner.createSwarmRun({
        projectId: input.projectId,
        kind: 'mission',
        entrypoint: `workflow:${params.workflowId}:${params.workflowNodeId}`,
        missionId: params.missionId,
        initialMemory: {
          ...(input.missionMemory ?? {}),
          workflowNodeId: params.workflowNodeId,
          task: params.task,
          previousOutputs: params.previousOutputs,
          ...(params.missionContextMemory ? { missionContextMemory: params.missionContextMemory } : {})
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
