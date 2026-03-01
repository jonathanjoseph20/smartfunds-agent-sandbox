export type RunState =
  | 'CREATED'
  | 'VALIDATED'
  | 'BRANCH_CREATED'
  | 'PATCH_APPLIED'
  | 'COMMITTED'
  | 'PUSHED'
  | 'PR_OPENED'
  | 'COMPLETED'
  | 'FAILED';
