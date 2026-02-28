import type { NormalizedCiSummary } from '../ci/types.ts';
import type { RetryAppliedFix, RetriableErrorCode } from '../retry/retry-engine.ts';
import type { PatchOp, PatchPlan } from '../retry/patchTypes.ts';

export type IneligibleReasonCode =
  | 'CI_PASSED'
  | 'CI_UNKNOWN'
  | 'NO_GOVERNING_FAILURE'
  | 'NON_GOVERNANCE_GOVERNING_FAILURE'
  | 'MISSING_GOVERNANCE_ERROR_CODE'
  | 'ERROR_CODE_NOT_RETRIABLE'
  | 'RETRY_ALREADY_CONSUMED'
  | 'MODE_NOT_AUTONOMOUS';

export type RetryDecisionSummary = {
  retryCount: 0 | 1;
  retryAttempt: 0 | 1;
  eligible: boolean;
  ineligibleReason: IneligibleReasonCode | null;
  trigger: {
    failingCheckName: string | null;
    governanceErrorCode: string | null;
  };
  retryContext: {
    consumed: boolean;
    retriableErrorCode: RetriableErrorCode | null;
  };
  action: {
    patchApplied: RetryAppliedFix | null;
    promptAmendmentApplied: boolean;
  };
  patchPlan: PatchPlan | null;
  patchOutcomeCode: 'applied' | 'noop' | 'failed';
  patchAppliedOps: PatchOp[];
  patchDryRun: boolean;
  patchCommands: string[];
  finalStatus: 'passed' | 'failed';
};

export type OrchestratorExecutionReportV1 = {
  version: 1;
  executionMode: 'structured' | 'autonomous';
  pr: {
    number: number | null;
    headSha: string | null;
  };
  ci: {
    normalized: NormalizedCiSummary;
  };
  retry: RetryDecisionSummary;
};
