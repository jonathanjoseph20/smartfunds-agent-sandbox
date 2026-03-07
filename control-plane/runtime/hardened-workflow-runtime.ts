import type { ExecutionEvent, ExecutionPhase } from '../journal/types.ts';
import type { ExecutionJournal } from '../journal/journal.ts';
import { buildWorkflowNodeRecords } from '../observability/node-record.ts';
import {
  reconstructWorkflowStateFromJournal,
  type ReconstructedWorkflowState
} from './recovery-engine.ts';
import {
  runWorkflowWithHardening,
  type WorkflowRuntimeHardeningOptions,
  type WorkflowTaskExecutor
} from '../workflows/workflow-runner.ts';
import type { ValidatedWorkflowDefinition, WorkflowRunResult } from '../workflows/workflow-types.ts';

const WORKFLOW_PHASE: ExecutionPhase = 'implement';

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function extractWorkflowNodeIdFromError(reason: string): string | null {
  const matched = reason.match(/workflowNodeId=([^\s]+)/);
  return matched?.[1] ?? null;
}

function deriveCompletedOutputs(input: {
  runId: string;
  workflowId: string;
  events: ExecutionEvent[];
}): Record<string, unknown> {
  const nodes = buildWorkflowNodeRecords({
    runId: input.runId,
    workflowId: input.workflowId,
    events: input.events
  });
  const completed = nodes
    .filter((node) => node.status === 'completed')
    .sort((left, right) => left.nodeId.localeCompare(right.nodeId));
  return Object.fromEntries(completed.map((node) => [node.nodeId, toRecord(node.taskOutputs)]));
}

export function deriveResumeStateFromJournal(input: {
  runId: string;
  workflowId: string;
  events: ExecutionEvent[];
  includeFailedNodeIds?: string[];
}): {
  state: ReconstructedWorkflowState;
  initialState: NonNullable<WorkflowRuntimeHardeningOptions['initialState']>;
} {
  const state = reconstructWorkflowStateFromJournal({
    runId: input.runId,
    workflowId: input.workflowId,
    events: input.events
  });

  const includeFailed = sortedUnique(input.includeFailedNodeIds ?? []);
  const completedNodeIds = sortedUnique([
    ...state.completedNodeIds,
    ...includeFailed.filter((nodeId) => state.nodeStates[nodeId] === 'completed')
  ]);

  return {
    state,
    initialState: {
      completedNodeIds,
      outputsByNodeId: deriveCompletedOutputs({
        runId: input.runId,
        workflowId: input.workflowId,
        events: input.events
      }),
      retriesByNodeId: { ...state.retryCountByNode },
      currentTick: state.currentTick
    }
  };
}

export async function executeWorkflowRunWithHardening(input: {
  journal: ExecutionJournal;
  runId: string;
  missionId: string;
  workflow: ValidatedWorkflowDefinition;
  executor: WorkflowTaskExecutor;
  hardening?: WorkflowRuntimeHardeningOptions;
}): Promise<WorkflowRunResult> {
  const runtimeHooks = input.hardening ?? {};

  try {
    const result = await runWorkflowWithHardening({
      missionId: input.missionId,
      workflow: input.workflow,
      executor: input.executor,
      hardening: {
        ...runtimeHooks,
        onNodeEvent(event) {
          input.journal.appendEvent({
            runId: input.runId,
            type: event.type,
            phase: WORKFLOW_PHASE,
            taskId: event.nodeId,
            payload: {
              runId: input.runId,
              workflowId: input.workflow.workflowId,
              missionId: input.missionId,
              task_inputs: event.previousOutputs,
              task_outputs: event.type === 'TASK_COMPLETED' ? { output: event.output } : {},
              agentId: event.agentId,
              adapterId: event.task,
              retryAttempt: event.retryAttempt,
              ...(event.failureCode ? { failureCode: event.failureCode } : {}),
              ...(event.reason ? { error: event.reason } : {}),
              context_snapshot: {
                missionId: input.missionId,
                metadata: {
                  runId: input.runId,
                  workflowId: input.workflow.workflowId,
                  missionId: input.missionId
                },
                memory: {
                  previousOutputs: event.previousOutputs
                }
              }
            }
          });
          runtimeHooks.onNodeEvent?.(event);
        },
        onRuntimeEvent(event) {
          input.journal.appendEvent({
            runId: input.runId,
            type: event.type,
            phase: WORKFLOW_PHASE,
            ...(event.nodeId ? { taskId: event.nodeId } : {}),
            payload: {
              runId: input.runId,
              workflowId: input.workflow.workflowId,
              missionId: input.missionId,
              ...(event.retryAttempt !== undefined ? { retryAttempt: event.retryAttempt } : {}),
              ...(event.tickDelay !== undefined ? { tickDelay: event.tickDelay } : {}),
              ...(event.failureCode ? { failureCode: event.failureCode } : {}),
              ...(event.safetyCode ? { safetyCode: event.safetyCode } : {}),
              ...(event.safetyMessage ? { message: event.safetyMessage } : {}),
              ...(event.safetyActual !== undefined ? { actual: event.safetyActual } : {}),
              ...(event.safetyLimit !== undefined ? { limit: event.safetyLimit } : {})
            }
          });
          runtimeHooks.onRuntimeEvent?.(event);
        }
      }
    });

    input.journal.appendEvent({
      runId: input.runId,
      type: 'RUN_COMPLETED',
      phase: WORKFLOW_PHASE,
      payload: {
        runId: input.runId,
        workflowId: input.workflow.workflowId,
        missionId: input.missionId,
        context_snapshot: {
          missionId: input.missionId,
          metadata: {
            runId: input.runId,
            workflowId: input.workflow.workflowId,
            missionId: input.missionId
          }
        }
      }
    });

    return result;
  } catch (error) {
    const reason = error instanceof Error && error.message.length > 0
      ? error.message
      : 'workflow.execution_failed';
    input.journal.appendEvent({
      runId: input.runId,
      type: 'RUN_FAILED',
      phase: WORKFLOW_PHASE,
      ...(extractWorkflowNodeIdFromError(reason) ? { taskId: extractWorkflowNodeIdFromError(reason) } : {}),
      payload: {
        runId: input.runId,
        workflowId: input.workflow.workflowId,
        missionId: input.missionId,
        error: reason
      }
    });
    throw error;
  }
}
