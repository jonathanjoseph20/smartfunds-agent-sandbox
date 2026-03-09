import type { WorkflowTaskExecutor } from '../control-plane/workflows/workflow-runner.ts';
import { fetchPage } from './adapters/browser/browser-adapter.ts';
import { extractStructuredData } from './adapters/extract/extract-adapter.ts';
import { invokeLLM } from './adapters/llm/llm-adapter.ts';
import { searchWeb } from './adapters/search/search-adapter.ts';
import { createLLMGateway, type LLMGateway } from './llm/gateway.ts';
import type { LLMRequest } from './llm/types.ts';
import { ArtifactWriter } from './output/artifact-writer.ts';
import { executeTool } from './tools/tool-registry.ts';

export type RuntimeTaskType =
  | 'llm.generate'
  | 'tool.web_search'
  | 'tool.page_fetch'
  | 'tool.reader_extract'
  | 'tool.pdf_extract'
  | 'tool.table_extract'
  | 'tool.company_extract'
  | 'tool.contact_extract'
  | 'tool.commodity_data'
  | 'tool.url_normalize'
  | 'tool.domain_classify'
  | 'tool.email_extract'
  | 'tool.list_rank'
  | 'tool.browser_fetch'
  | 'adapter.llm_invoke'
  | 'adapter.search_web'
  | 'adapter.fetch_page'
  | 'adapter.extract_structured_data'
  | 'output.write_csv'
  | 'output.write_xlsx'
  | 'output.write_artifact'
  | 'output.write_markdown';

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

  if (input.taskType === 'tool.pdf_extract') {
    const response = await executeTool({
      toolId: 'pdf_extract',
      action: 'extract',
      input: input.payload
    });
    if (!response.ok) {
      throw new Error(response.errors.join('; '));
    }
    return ensureRecord(response.data);
  }

  if (input.taskType === 'tool.table_extract') {
    const response = await executeTool({
      toolId: 'table_extract',
      action: 'extract',
      input: input.payload
    });
    if (!response.ok) {
      throw new Error(response.errors.join('; '));
    }
    return ensureRecord(response.data);
  }

  if (input.taskType === 'tool.company_extract') {
    const response = await executeTool({
      toolId: 'company_extract',
      action: 'extract',
      input: input.payload
    });
    if (!response.ok) {
      throw new Error(response.errors.join('; '));
    }
    return ensureRecord(response.data);
  }

  if (input.taskType === 'tool.contact_extract') {
    const response = await executeTool({
      toolId: 'contact_extract',
      action: 'extract',
      input: input.payload
    });
    if (!response.ok) {
      throw new Error(response.errors.join('; '));
    }
    return ensureRecord(response.data);
  }

  if (input.taskType === 'tool.commodity_data') {
    const response = await executeTool({
      toolId: 'commodity_data',
      action: 'extract',
      input: input.payload
    });
    if (!response.ok) {
      throw new Error(response.errors.join('; '));
    }
    return ensureRecord(response.data);
  }

  if (input.taskType === 'tool.url_normalize') {
    const response = await executeTool({
      toolId: 'url_normalize',
      action: 'normalize',
      input: input.payload
    });
    if (!response.ok) {
      throw new Error(response.errors.join('; '));
    }
    return ensureRecord(response.data);
  }

  if (input.taskType === 'tool.domain_classify') {
    const response = await executeTool({
      toolId: 'domain_classify',
      action: 'classify',
      input: input.payload
    });
    if (!response.ok) {
      throw new Error(response.errors.join('; '));
    }
    return ensureRecord(response.data);
  }

  if (input.taskType === 'tool.email_extract') {
    const response = await executeTool({
      toolId: 'email_extract',
      action: 'extract',
      input: input.payload
    });
    if (!response.ok) {
      throw new Error(response.errors.join('; '));
    }
    return ensureRecord(response.data);
  }

  if (input.taskType === 'tool.list_rank') {
    const response = await executeTool({
      toolId: 'list_rank',
      action: 'rank',
      input: input.payload
    });
    if (!response.ok) {
      throw new Error(response.errors.join('; '));
    }
    return ensureRecord(response.data);
  }

  if (input.taskType === 'tool.browser_fetch') {
    const response = await executeTool({
      toolId: 'browser_fetch',
      action: 'fetch',
      input: input.payload
    });
    if (!response.ok) {
      throw new Error(response.errors.join('; '));
    }
    return ensureRecord(response.data);
  }

  if (input.taskType === 'adapter.llm_invoke') {
    const response = await invokeLLM({
      prompt: typeof input.payload.prompt === 'string' ? input.payload.prompt : '',
      systemPrompt: typeof input.payload.systemPrompt === 'string' ? input.payload.systemPrompt : undefined,
      model: typeof input.payload.model === 'string' ? input.payload.model : undefined,
      temperature: typeof input.payload.temperature === 'number' ? input.payload.temperature : undefined,
      maxTokens: typeof input.payload.maxTokens === 'number' ? input.payload.maxTokens : undefined
    });
    return response as unknown as Record<string, unknown>;
  }

  if (input.taskType === 'adapter.search_web') {
    const results = await searchWeb({
      query: typeof input.payload.query === 'string' ? input.payload.query : '',
      maxResults: typeof input.payload.maxResults === 'number' ? input.payload.maxResults : undefined
    }, {
      fetchImpl: typeof input.payload.fetchImpl === 'function' ? input.payload.fetchImpl as typeof fetch : undefined
    });
    return { results: [...results].sort((left, right) => left.rank - right.rank) };
  }

  if (input.taskType === 'adapter.fetch_page') {
    const page = await fetchPage({
      url: typeof input.payload.url === 'string' ? input.payload.url : ''
    }, {
      fetchImpl: typeof input.payload.fetchImpl === 'function' ? input.payload.fetchImpl as typeof fetch : undefined
    });
    return page as unknown as Record<string, unknown>;
  }

  if (input.taskType === 'adapter.extract_structured_data') {
    const schema = ensureRecord(input.payload.schema);
    const data = await extractStructuredData({
      text: typeof input.payload.text === 'string' ? input.payload.text : '',
      schema: Object.fromEntries(
        Object.entries(schema)
          .filter(([, value]) => typeof value === 'string')
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, value]) => [key, value as string])
      )
    });
    return { data };
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
        const order = typeof sheet.order === 'number' ? sheet.order : undefined;
        return { name, rows, columns, order };
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
    const payload = input.payload.payload ?? {};
    const filePath = input.artifactWriter.writeArtifact({
      missionId: input.missionId,
      runId: input.runId,
      artifactId,
      payload
    });

    return { filePath };
  }

  if (input.taskType === 'output.write_markdown') {
    const artifactId = typeof input.payload.artifactId === 'string' ? input.payload.artifactId : '';
    const content = typeof input.payload.content === 'string' ? input.payload.content : '';
    const filePath = input.artifactWriter.writeMarkdown({
      missionId: input.missionId,
      runId: input.runId,
      artifactId,
      content
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
