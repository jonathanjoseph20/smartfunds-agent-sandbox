import { executeRuntimeTask, type RuntimeTaskType } from '../../../runtime/runtime-task-executor.ts';
import { createLLMGateway } from '../../../runtime/llm/gateway.ts';
import { ArtifactWriter, type DeclaredArtifact } from '../../../runtime/output/artifact-writer.ts';
import type { AgentTaskAdapter } from '../adapter-interface.ts';
import type { TaskContext } from '../task-context.ts';
import type { TaskResult } from '../task-result.ts';

const RUNTIME_TASK_TYPES: RuntimeTaskType[] = [
  'llm.generate',
  'tool.web_search',
  'tool.page_fetch',
  'tool.reader_extract',
  'tool.pdf_extract',
  'tool.table_extract',
  'tool.company_extract',
  'tool.contact_extract',
  'tool.commodity_data',
  'tool.url_normalize',
  'tool.domain_classify',
  'tool.email_extract',
  'tool.list_rank',
  'tool.browser_fetch',
  'adapter.llm_invoke',
  'adapter.search_web',
  'adapter.fetch_page',
  'adapter.extract_structured_data',
  'output.write_csv',
  'output.write_xlsx',
  'output.write_artifact',
  'output.write_markdown'
];

const ARTIFACTS_BASE_DIR = 'runtime-data/artifacts';

function toDeclaredArtifacts(input: unknown): DeclaredArtifact[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => entry as Record<string, unknown>)
    .flatMap((entry) => {
      const artifactId = typeof entry.artifactId === 'string' ? entry.artifactId.trim() : '';
      const format = entry.format;
      if (
        artifactId.length === 0
        || (format !== 'csv' && format !== 'xlsx' && format !== 'artifact' && format !== 'markdown')
      ) {
        return [];
      }
      return [{ artifactId, format } as DeclaredArtifact];
    })
    .sort((left, right) => left.artifactId.localeCompare(right.artifactId));
}

function splitError(message: string): { errorCode: string; errorMessage: string } {
  const matched = message.match(/^(ERR_[A-Z0-9_]+|LLM_[A-Z0-9_]+):\s*(.*)$/);
  if (!matched) {
    return {
      errorCode: 'ERR_RUNTIME_TASK_EXECUTION',
      errorMessage: message
    };
  }

  return {
    errorCode: matched[1],
    errorMessage: matched[2] || matched[1]
  };
}

async function execute(context: TaskContext, taskType: RuntimeTaskType): Promise<TaskResult> {
  const artifactWriter = new ArtifactWriter(
    ARTIFACTS_BASE_DIR,
    toDeclaredArtifacts(context.executionContext.memory.declaredArtifacts)
  );

  try {
    const result = await executeRuntimeTask({
      taskType,
      payload: context.inputs,
      missionId: context.executionContext.missionId ?? 'unknown-mission',
      runId: context.runId,
      workflowNodeId: context.taskId,
      missionContextMemory: context.executionContext.memory,
      llmGateway: createLLMGateway(),
      artifactWriter
    });

    return {
      status: 'success',
      outputs: result,
      artifacts: typeof result.filePath === 'string'
        ? [{ path: result.filePath }]
        : [],
      logs: ['RUNTIME_TASK_EXECUTED']
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const parsed = splitError(message);

    return {
      status: 'failed',
      outputs: {},
      artifacts: [],
      logs: ['RUNTIME_TASK_FAILED'],
      errorCode: parsed.errorCode,
      errorMessage: parsed.errorMessage
    };
  }
}

function makeRuntimeAdapter(type: RuntimeTaskType): AgentTaskAdapter {
  return {
    type,
    async execute(context: TaskContext) {
      return execute(context, type);
    }
  };
}

export const runtimeTaskAdapters: AgentTaskAdapter[] = RUNTIME_TASK_TYPES.map((type) => makeRuntimeAdapter(type));
