import type { ExecutionJournal } from '../journal/journal.ts';
import { createExecutionJournal } from '../journal/journal.ts';
import { getRunDiagnosticReport } from '../observability/diagnostics.ts';
import { buildWorkflowNodeRecords } from '../observability/node-record.ts';
import { buildWorkflowRunRecord, buildWorkflowRunRecords } from '../observability/run-record.ts';
import { buildWorkflowTrace } from '../observability/trace-builder.ts';

type WorkflowServiceOptions = {
  journal?: ExecutionJournal;
  rootDir?: string;
};

function buildJournal(options: WorkflowServiceOptions): ExecutionJournal {
  return options.journal ?? createExecutionJournal({ rootDir: options.rootDir });
}

export function createWorkflowService(options: WorkflowServiceOptions = {}) {
  const journal = buildJournal(options);

  function listWorkflows(): Array<Record<string, unknown>> {
    const records = buildWorkflowRunRecords({
      runs: journal.listRuns(),
      inspectRun: (runId) => journal.inspectRun(runId)
    });

    return records.map((record) => ({
      runId: record.runId,
      workflowId: record.workflowId,
      missionId: record.missionId,
      status: record.status,
      completedNodeCount: record.completedNodeCount,
      failedNodeCount: record.failedNodeCount,
      timeoutNodeCount: record.timeoutNodeCount,
      retryCount: record.retryCount
    }));
  }

  function inspectWorkflow(input: { runId: string }): Record<string, unknown> {
    const inspected = journal.inspectRun(input.runId);
    const runRecord = buildWorkflowRunRecord(inspected);
    const nodeRecords = buildWorkflowNodeRecords({
      runId: runRecord.runId,
      workflowId: runRecord.workflowId,
      events: inspected.events
    });
    const diagnostics = getRunDiagnosticReport({
      run: runRecord,
      events: inspected.events,
      nodes: nodeRecords
    });

    return {
      runId: runRecord.runId,
      workflowId: runRecord.workflowId,
      missionId: runRecord.missionId,
      status: runRecord.status,
      summary: runRecord.summary,
      nodeStates: nodeRecords.map((node) => ({
        nodeId: node.nodeId,
        status: node.status,
        retryCount: node.retryCount,
        timeoutType: node.timeoutType,
        sequenceStarted: node.sequenceStarted,
        sequenceCompleted: node.sequenceCompleted,
        agentId: node.agentId,
        adapterId: node.adapterId
      })),
      diagnostics: {
        failedNodeIds: diagnostics.failedNodeIds,
        timedOutNodeIds: diagnostics.timedOutNodeIds,
        recoverable: diagnostics.recoverable,
        resumed: diagnostics.resumed,
        cancelled: diagnostics.cancelled,
        safetyViolationNodeIds: diagnostics.safetyViolationNodeIds,
        firstInspectTarget: diagnostics.firstInspectTarget,
        finalContextKeys: diagnostics.finalContextKeys
      }
    };
  }

  function traceWorkflow(input: { runId: string }): Record<string, unknown> {
    const inspected = journal.inspectRun(input.runId);
    const runRecord = buildWorkflowRunRecord(inspected);
    const nodeRecords = buildWorkflowNodeRecords({
      runId: runRecord.runId,
      workflowId: runRecord.workflowId,
      events: inspected.events
    });

    const trace = buildWorkflowTrace({
      runId: runRecord.runId,
      workflowId: runRecord.workflowId,
      events: inspected.events,
      nodeRecords
    });

    const executionOrder = trace
      .filter((entry) => entry.type === 'NODE_STARTED')
      .map((entry) => entry.nodeId)
      .filter((value): value is string => typeof value === 'string');

    const retries = trace.filter((entry) => entry.type === 'NODE_RETRY_SCHEDULED' || entry.type === 'NODE_RETRY_STARTED');
    const failures = trace.filter((entry) => entry.type === 'TASK_FAILED' || entry.type === 'NODE_TIMEOUT' || entry.type === 'ADAPTER_TIMEOUT');

    return {
      runId: runRecord.runId,
      workflowId: runRecord.workflowId,
      status: runRecord.status,
      executionOrder,
      retries,
      failures,
      trace
    };
  }

  return {
    listWorkflows,
    inspectWorkflow,
    traceWorkflow
  };
}

export type WorkflowService = ReturnType<typeof createWorkflowService>;
