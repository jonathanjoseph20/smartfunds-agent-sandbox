import type { OrchestratorExecutionReportV1 } from './types.ts';

type BuildOrchestratorExecutionReportV1Params = Omit<OrchestratorExecutionReportV1, 'version'>;

export function buildOrchestratorExecutionReportV1(
  params: BuildOrchestratorExecutionReportV1Params
): OrchestratorExecutionReportV1 {
  return {
    version: 1,
    executionMode: params.executionMode,
    pr: {
      number: params.pr.number,
      headSha: params.pr.headSha
    },
    ci: {
      normalized: params.ci.normalized
    },
    retry: {
      retryCount: params.retry.retryCount,
      eligible: params.retry.eligible,
      ineligibleReason: params.retry.ineligibleReason,
      trigger: {
        failingCheckName: params.retry.trigger.failingCheckName,
        governanceErrorCode: params.retry.trigger.governanceErrorCode
      },
      retryContext: {
        consumed: params.retry.retryContext.consumed,
        retriableErrorCode: params.retry.retryContext.retriableErrorCode
      },
      action: {
        patchApplied: params.retry.action.patchApplied,
        promptAmendmentApplied: params.retry.action.promptAmendmentApplied
      },
      finalStatus: params.retry.finalStatus
    }
  };
}
