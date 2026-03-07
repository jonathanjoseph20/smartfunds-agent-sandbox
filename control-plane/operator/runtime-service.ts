import type { ExecutionJournal } from '../journal/journal.ts';
import { createExecutionJournal } from '../journal/journal.ts';
import { buildWorkflowNodeRecords } from '../observability/node-record.ts';
import { buildWorkflowRunRecord, buildWorkflowRunRecords } from '../observability/run-record.ts';
import {
  cancelWorkflowRun,
  deriveRetryEligibilityFromEvents,
  resumeWorkflowRun
} from '../runtime/recovery-engine.ts';
import { deriveResumeStateFromJournal, executeWorkflowRunWithHardening } from '../runtime/hardened-workflow-runtime.ts';
import { createSwarmRunner } from '../swarm/swarm-runner.ts';
import { loadWorkflowDefinitionById } from '../workflows/workflow-loader.ts';
import { createSwarmWorkflowExecutor } from '../workflows/workflow-runner.ts';

type RuntimeServiceOptions = {
  journal?: ExecutionJournal;
  rootDir?: string;
  workflowsDir?: string;
};

function buildJournal(options: RuntimeServiceOptions): ExecutionJournal {
  return options.journal ?? createExecutionJournal({ rootDir: options.rootDir });
}

export function createRuntimeService(options: RuntimeServiceOptions = {}) {
  const journal = buildJournal(options);

  async function retryWorkflowNode(input: { runId: string; nodeId: string }): Promise<Record<string, unknown>> {
    const inspected = journal.inspectRun(input.runId);
    const runRecord = buildWorkflowRunRecord(inspected);

    const nodes = buildWorkflowNodeRecords({
      runId: runRecord.runId,
      workflowId: runRecord.workflowId,
      events: inspected.events
    });

    const node = nodes.find((entry) => entry.nodeId === input.nodeId);
    if (!node) {
      throw new Error(`NODE_NOT_FOUND: ${input.nodeId}`);
    }
    if (node.status !== 'failed' && node.status !== 'timeout') {
      throw new Error('NODE_NOT_RETRYABLE_STATE');
    }

    const decision = deriveRetryEligibilityFromEvents({
      runId: runRecord.runId,
      workflowId: runRecord.workflowId,
      nodeId: input.nodeId,
      events: inspected.events
    });

    if (!decision.accepted) {
      throw new Error(`RETRY_INELIGIBLE: ${decision.reason}`);
    }

    const workflow = loadWorkflowDefinitionById(runRecord.workflowId, options.workflowsDir);
    journal.appendEvent({
      runId: runRecord.runId,
      type: 'NODE_RETRY_SCHEDULED',
      phase: 'implement',
      taskId: input.nodeId,
      payload: {
        retryAttempt: decision.retryAttempt,
        tickDelay: decision.tickDelay,
        workflowId: runRecord.workflowId,
        runId: runRecord.runId
      }
    });

    const refreshed = journal.inspectRun(runRecord.runId);
    const derived = deriveResumeStateFromJournal({
      runId: runRecord.runId,
      workflowId: runRecord.workflowId,
      events: refreshed.events
    });

    const scheduledTick = (derived.initialState.currentTick ?? 0) + (decision.tickDelay ?? 0);
    const missionId = runRecord.missionId ?? `recovery:${runRecord.runId}`;
    const swarmRunner = createSwarmRunner({ journal });
    const executor = createSwarmWorkflowExecutor({
      swarmRunner,
      projectId: refreshed.run.projectId
    });

    await executeWorkflowRunWithHardening({
      journal,
      runId: runRecord.runId,
      missionId,
      workflow,
      executor,
      hardening: {
        initialState: {
          ...derived.initialState,
          retryQueue: [{
            nodeId: input.nodeId,
            retryAttempt: decision.retryAttempt ?? 1,
            scheduledTick
          }]
        }
      }
    });

    return {
      runId: runRecord.runId,
      workflowId: runRecord.workflowId,
      nodeId: input.nodeId,
      retryAttempt: decision.retryAttempt,
      tickDelay: decision.tickDelay,
      scheduled: true,
      started: (decision.tickDelay ?? 0) === 0
    };
  }

  async function resumeWorkflow(input: { runId: string }): Promise<Record<string, unknown>> {
    const inspected = journal.inspectRun(input.runId);
    const runRecord = buildWorkflowRunRecord(inspected);
    const workflow = loadWorkflowDefinitionById(runRecord.workflowId, options.workflowsDir);

    const derived = deriveResumeStateFromJournal({
      runId: runRecord.runId,
      workflowId: runRecord.workflowId,
      events: inspected.events
    });

    const decision = resumeWorkflowRun({
      workflow,
      state: derived.state
    });

    if (!decision.accepted) {
      throw new Error(`WORKFLOW_NOT_RESUMABLE: ${decision.reason}`);
    }

    journal.appendEvent({
      runId: runRecord.runId,
      type: 'WORKFLOW_RECOVERY_STARTED',
      phase: 'implement',
      payload: {
        workflowId: runRecord.workflowId,
        runId: runRecord.runId,
        resumeNodeIds: decision.plan.resumeNodeIds,
        skippedCompletedNodeIds: decision.plan.skippedCompletedNodeIds
      }
    });

    journal.appendEvent({
      runId: runRecord.runId,
      type: 'WORKFLOW_RECOVERY_RESUMED',
      phase: 'implement',
      payload: {
        workflowId: runRecord.workflowId,
        runId: runRecord.runId,
        resumeNodeIds: decision.plan.resumeNodeIds
      }
    });

    const missionId = runRecord.missionId ?? `recovery:${runRecord.runId}`;
    const swarmRunner = createSwarmRunner({ journal });
    const executor = createSwarmWorkflowExecutor({
      swarmRunner,
      projectId: inspected.run.projectId
    });

    await executeWorkflowRunWithHardening({
      journal,
      runId: runRecord.runId,
      missionId,
      workflow,
      executor,
      hardening: {
        initialState: derived.initialState
      }
    });

    return {
      runId: runRecord.runId,
      workflowId: runRecord.workflowId,
      resumedNodeIds: decision.plan.resumeNodeIds,
      skippedCompletedNodeIds: decision.plan.skippedCompletedNodeIds
    };
  }

  function cancelWorkflow(input: { runId: string }): Record<string, unknown> {
    const inspected = journal.inspectRun(input.runId);
    const runRecord = buildWorkflowRunRecord(inspected);

    const derived = deriveResumeStateFromJournal({
      runId: runRecord.runId,
      workflowId: runRecord.workflowId,
      events: inspected.events
    });

    const decision = cancelWorkflowRun({
      state: derived.state
    });

    if (!decision.accepted) {
      throw new Error('WORKFLOW_ALREADY_TERMINAL');
    }

    journal.appendEvent({
      runId: runRecord.runId,
      type: 'WORKFLOW_CANCELLED',
      phase: 'implement',
      payload: {
        workflowId: runRecord.workflowId,
        runId: runRecord.runId
      }
    });

    return {
      runId: runRecord.runId,
      workflowId: runRecord.workflowId,
      status: 'cancelled'
    };
  }

  function cancelMission(input: { missionId: string }): Record<string, unknown> {
    const runRecords = buildWorkflowRunRecords({
      runs: journal.listRuns(),
      inspectRun: (runId) => journal.inspectRun(runId)
    }).filter((record) => record.missionId === input.missionId)
      .sort((left, right) => left.runId.localeCompare(right.runId));

    const active = [...runRecords]
      .reverse()
      .find((record) => record.status === 'created' || record.status === 'running');

    if (!active) {
      throw new Error(`MISSION_NOT_CANCELLABLE: ${input.missionId}`);
    }

    const cancelled = cancelWorkflow({ runId: active.runId });
    return {
      missionId: input.missionId,
      runId: active.runId,
      status: 'cancelled',
      workflow: cancelled
    };
  }

  return {
    retryWorkflowNode,
    resumeWorkflow,
    cancelWorkflow,
    cancelMission
  };
}

export type RuntimeService = ReturnType<typeof createRuntimeService>;
