export type ProfileErrorCode =
  | 'PROFILE_INVALID'
  | 'PROFILE_CAPABILITY_DENIED'
  | 'PROFILE_EXECUTION_PATH_REQUIRED'
  | 'LITE_REPO_MUTATION_FORBIDDEN'
  | 'LITE_PR_OPEN_FORBIDDEN'
  | 'LITE_PROTECTED_WRITE_FORBIDDEN';

export class ProfilePolicyError extends Error {
  readonly code: ProfileErrorCode;

  constructor(code: ProfileErrorCode, reason: string) {
    super(`${code}: ${reason}`);
    this.code = code;
  }
}

