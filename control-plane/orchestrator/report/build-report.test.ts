import { describe, expect, it } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { buildOrchestratorExecutionReportV1 } from './build-report.ts';

describe('build orchestrator execution report v1', () => {
  it('builds deterministic report payload', () => {
    const report = buildOrchestratorExecutionReportV1({
      executionMode: 'autonomous',
      pr: {
        number: 41,
        headSha: 'abc123'
      },
      ci: {
        normalized: {
          ciStatus: 'failed',
          checks: [],
          failedChecks: [],
          governingFailure: null,
          governingReason: null
        }
      },
      retry: {
        retryCount: 1,
        retryAttempt: 1,
        eligible: false,
        ineligibleReason: 'RETRY_ALREADY_CONSUMED',
        trigger: {
          failingCheckName: null,
          governanceErrorCode: null
        },
        retryContext: {
          consumed: true,
          retriableErrorCode: null
        },
        action: {
          patchApplied: null,
          promptAmendmentApplied: false
        },
        patchPlan: null,
        patchOutcomeCode: 'noop',
        patchAppliedOps: [],
        patchDryRun: false,
        patchCommands: [],
        finalStatus: 'failed'
      }
    });

    expect(canonicalStringify(report)).toBe(
      '{"ci":{"normalized":{"checks":[],"ciStatus":"failed","failedChecks":[],"governingFailure":null,"governingReason":null}},"executionMode":"autonomous","pr":{"headSha":"abc123","number":41},"retry":{"action":{"patchApplied":null,"promptAmendmentApplied":false},"eligible":false,"finalStatus":"failed","ineligibleReason":"RETRY_ALREADY_CONSUMED","patchAppliedOps":[],"patchCommands":[],"patchDryRun":false,"patchOutcomeCode":"noop","patchPlan":null,"retryAttempt":1,"retryContext":{"consumed":true,"retriableErrorCode":null},"retryCount":1,"trigger":{"failingCheckName":null,"governanceErrorCode":null}},"version":1}'
    );
  });
});
