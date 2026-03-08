export const TASK_TYPES = ['llm', 'shell', 'repo', 'web_search', 'web_fetch', 'twitter_search'] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export function isTaskType(value: string): value is TaskType {
  return TASK_TYPES.includes(value as TaskType);
}
