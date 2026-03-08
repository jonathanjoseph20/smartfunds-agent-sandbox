import type { WorkflowTaskExecutor } from '../control-plane/workflows/workflow-runner.ts';
import { createLLMGateway, type LLMGateway } from './llm/gateway.ts';
import type { LLMRequest } from './llm/types.ts';
import { ArtifactWriter } from './output/artifact-writer.ts';
import { executeTool } from './tools/tool-registry.ts';

export type RuntimeTaskType =
  | 'llm.generate'
  | 'tool.web_search'
  | 'tool.page_fetch'
  | 'tool.reader_extract'
  | 'output.write_csv'
  | 'output.write_xlsx'
  | 'output.write_artifact';

function ensureRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .sort((left, right) => left.localeCompare(right));
}

function toPromptEnvelope(input: {
  missionId: string;
  runId: string;
  workflowNodeId: string;
  taskType: string;
  payload: Record<string, unknown>;
  missionContextMemory?: Record<string, unknown>;
}): LLMRequest['promptEnvelope'] {
  const memory = ensureRecord(input.missionContextMemory);
  const teamId = typeof memory.teamId === 'string' ? memory.teamId : 'unknown-team';
  const agentId = typeof memory.agentId === 'string' ? memory.agentId : 'unknown-agent';

  return {
    missionId: input.missionId,
    runId: input.runId,
    workflowNodeId: input.workflowNodeId,
    teamId,
    agentId,
    taskType: input.taskType,
    inputs: ensureRecord(input.payload.inputs),
    constraints: asStringArray(input.payload.constraints),
    requestedArtifacts: asStringArray(input.payload.requestedArtifacts),
    outputInstructions: typeof input.payload.outputInstructions === 'string'
      ? input.payload.outputInstructions
      : ''
  };
}

export async function executeRuntimeTask(input: {
  taskType: RuntimeTaskType;
  payload: Record<string, unknown>;
  missionId: string;
  runId: string;
  workflowNodeId: string;
  missionContextMemory?: Record<string, unknown>;
  llmGateway: LLMGateway;
  artifactWriter: ArtifactWriter;
}): Promise<Record<string, unknown>> {
  if (input.taskType === 'llm.generate') {
    const request: LLMRequest = {
      taskType: typeof input.payload.taskType === 'string' ? input.payload.taskType : 'default',
      routeHint: typeof input.payload.routeHint === 'string' ? input.payload.routeHint : undefined,
      providerPreference: typeof input.payload.providerPreference === 'string'
        ? input.payload.providerPreference
        : null,
      outputMode: input.payload.outputMode === 'json' || input.payload.outputMode === 'best-effort-json'
        ? input.payload.outputMode
        : 'text',
      maxTokens: typeof input.payload.maxTokens === 'number' ? input.payload.maxTokens : undefined,
      promptEnvelope: toPromptEnvelope({
        missionId: input.missionId,
        runId: input.runId,
        workflowNodeId: input.workflowNodeId,
        taskType: typeof input.payload.taskType === 'string' ? input.payload.taskType : 'default',
        payload: input.payload,
        missionContextMemory: input.missionContextMemory
      })
    };

    return input.llmGateway.invoke(request) as unknown as Record<string, unknown>;
  }

  if (input.taskType === 'tool.web_search') {
    const response = await executeTool({
      toolId: 'web_search',
      action: 'search',
      input: input.payload
    });
    if (!response.ok) {
      throw new Error(response.errors.join('; '));
    }
    return ensureRecord(response.data);
  }

  if (input.taskType === 'tool.page_fetch') {
    const response = await executeTool({
      toolId: 'page_fetch',
      action: 'fetch',
      input: input.payload
    });
    if (!response.ok) {
      throw new Error(response.errors.join('; '));
    }
    return ensureRecord(response.data);
  }

  if (input.taskType === 'tool.reader_extract') {
    const response = await executeTool({
      toolId: 'reader_extract',
      action: 'extract',
      input: input.payload
    });
    if (!response.ok) {
      throw new Error(response.errors.join('; '));
    }
    return ensureRecord(response.data);
  }

  if (input.taskType === 'output.write_csv') {
    const artifactId = typeof input.payload.artifactId === 'string' ? input.payload.artifactId : '';
    const rows = Array.isArray(input.payload.rows) ? input.payload.rows as Array<Record<string, unknown>> : [];
    const columns = Array.isArray(input.payload.columns)
      ? input.payload.columns.filter((entry): entry is string => typeof entry === 'string')
      : undefined;

    const filePath = input.artifactWriter.writeCsv({
      missionId: input.missionId,
      runId: input.runId,
      artifactId,
      rows,
      columns
    });
    return { filePath };
  }

  if (input.taskType === 'output.write_xlsx') {
    const artifactId = typeof input.payload.artifactId === 'string' ? input.payload.artifactId : '';
    const rawSheets = Array.isArray(input.payload.sheets) ? input.payload.sheets : [];
    const sheets = rawSheets
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => {
        const sheet = entry as Record<string, unknown>;
        const name = typeof sheet.name === 'string' ? sheet.name : 'Sheet1';
        const rows = Array.isArray(sheet.rows) ? sheet.rows as Array<Record<string, unknown>> : [];
        const columns = Array.isArray(sheet.columns)
          ? sheet.columns.filter((column): column is string => typeof column === 'string')
          : undefined;
        return { name, rows, columns };
      });

    const filePath = input.artifactWriter.writeXlsx({
      missionId: input.missionId,
      runId: input.runId,
      artifactId,
      sheets
    });
    return { filePath };
  }

  if (input.taskType === 'output.write_artifact') {
    const artifactId = typeof input.payload.artifactId === 'string' ? input.payload.artifactId : '';
    const payload = ensureRecord(input.payload.payload);
    const filePath = input.artifactWriter.writeArtifact({
      missionId: input.missionId,
      runId: input.runId,
      artifactId,
      payload
    });

    return { filePath };
  }

  throw new Error(`ERR_RUNTIME_TASK_UNSUPPORTED: ${input.taskType}`);
}

export function createWorkflowDagTaskExecutor(input: {
  runId: string;
  llmGateway?: LLMGateway;
  artifactWriter: ArtifactWriter;
}): WorkflowTaskExecutor {
  const llmGateway = input.llmGateway ?? createLLMGateway();

  return {
    async execute(context) {
      const taskInputsByNode = ensureRecord(context.missionContextMemory?.taskInputsByNode);
      const payload = ensureRecord(taskInputsByNode[context.workflowNodeId]);
      return executeRuntimeTask({
        taskType: context.task as RuntimeTaskType,
        payload,
        missionId: context.missionId,
        runId: input.runId,
        workflowNodeId: context.workflowNodeId,
        missionContextMemory: context.missionContextMemory,
        llmGateway,
        artifactWriter: input.artifactWriter
      });
    }
  };
}
