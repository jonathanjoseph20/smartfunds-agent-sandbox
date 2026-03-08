export interface ToolAdapter<Request, Result> {
  readonly toolId: string;
  execute(request: Request): Promise<Result>;
}
