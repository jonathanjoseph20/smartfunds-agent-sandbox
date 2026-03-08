export const TASK_TYPES = [
  'llm',
  'shell',
  'repo',
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
  'output.write_csv',
  'output.write_xlsx',
  'output.write_artifact'
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export function isTaskType(value: string): value is TaskType {
  return TASK_TYPES.includes(value as TaskType);
}
