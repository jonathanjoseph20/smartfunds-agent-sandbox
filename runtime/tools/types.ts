export interface ToolRequest {
  toolId: string;
  action: string;
  input: Record<string, unknown>;
}

export interface ToolResponse {
  toolId: string;
  action: string;
  ok: boolean;
  data: Record<string, unknown> | null;
  errors: string[];
}

export interface ToolAdapter {
  toolId: string;
  action: string;
  execute(input: Record<string, unknown>): Promise<Record<string, unknown>>;
}
