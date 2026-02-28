export type PatchOp =
  | { op: 'add_label'; label: string }
  | { op: 'set_pr_body'; body: string }
  | { op: 'refresh_payload'; method: 'empty_commit' }
  | { op: 'noop'; reason: string };

export type PatchPlan = {
  version: 'v1';
  governanceErrorCode: string;
  retryAttempt: number;
  ops: PatchOp[];
  notes?: string[];
};
