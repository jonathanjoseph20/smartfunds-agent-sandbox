export const TASK_TYPES = [
  'llm',
  'shell',
  'repo',
  'llm.generate',
  'tool.web_search',
  'tool.page_fetch',
  'tool.reader_extract',
  'output.write_csv',
  'output.write_xlsx',
  'output.write_artifact'
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export function isTaskType(value: string): value is TaskType {
  return TASK_TYPES.includes(value as TaskType);
}
