import type { GovernanceError, GovernanceErrorCode, GovernanceReport } from '../diagnostics.ts';

export type RetryLoopStatus = 'applied' | 'noop' | 'unsupported' | 'already-attempted';

export type RetryActionCode =
  | 'MISSING_LABEL'
  | 'MISSING_TIER_LABEL'
  | 'MISSING_EVIDENCE_BLOCK'
  | 'MISSING_EVIDENCE_FIELDS';

export type RetryActionCategory = 'labels' | 'body';

export type RetrySelection =
  | {
      status: 'selected';
      code: RetryActionCode;
      category: RetryActionCategory;
      blockingErrorCodes: GovernanceErrorCode[];
    }
  | {
      status: 'no-blocking';
      blockingErrorCodes: GovernanceErrorCode[];
    }
  | {
      status: 'unsupported';
      blockingErrorCodes: GovernanceErrorCode[];
      unsupportedBlockingCodes: GovernanceErrorCode[];
    };

export type RetryPlan = {
  pr: number;
  attempt: number;
  status: RetryLoopStatus;
  selectedActionCode: RetryActionCode | null;
  refusalReason: string | null;
  appliedChanges: {
    labelsAdded: string[];
    bodyPatched: boolean;
    triggerCommitCreated: boolean;
  };
};

export type RetryRunOptions = {
  pr?: number;
  dryRun: boolean;
  verbose: boolean;
};

export type RetryStateEntry = {
  attempts: number;
  lastActionCodes: GovernanceErrorCode[];
  lastOutcome: 'applied' | 'refused' | 'noop';
  lastCommitSha: string;
};

export type RetryState = {
  version: 1;
  prs: Record<string, RetryStateEntry>;
};

export type PreflightReportEnvelope = {
  report: GovernanceReport;
  errors: GovernanceError[];
};
