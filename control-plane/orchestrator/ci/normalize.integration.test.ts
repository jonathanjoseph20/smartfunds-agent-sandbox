import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { createInitialRetryState } from '../retry/retry-engine.ts';
import { evaluateRetryEligibilityForNormalizedCi } from './retry-eligibility.ts';
import { normalizeCi } from './normalize.ts';
import { buildOrchestratorExecutionReportV1 } from '../report/build-report.ts';
import type { RawCheck } from './types.ts';

function readFixture(name: string): RawCheck[] {
  return JSON.parse(fs.readFileSync(`control-plane/orchestrator/ci/fixtures/ci/${name}.json`, 'utf8')) as RawCheck[];
}

function snapshotPath(name: string): string {
  return `control-plane/orchestrator/ci/fixtures/reports/${name}.json`;
}

function buildScenarioReport(name: string, executionMode: 'structured' | 'autonomous' = 'autonomous') {
  const normalized = normalizeCi(readFixture(name));
  const eligibility = evaluateRetryEligibilityForNormalizedCi({
    executionMode,
    ci: normalized,
    retryState: createInitialRetryState()
  });

  const report = buildOrchestratorExecutionReportV1({
    executionMode,
    pr: {
      number: 41,
      headSha: 'abc123'
    },
    ci: {
      normalized
    },
    retry: {
      retryCount: 0,
      retryAttempt: 0,
      eligible: eligibility.eligible,
      ineligibleReason: eligibility.ineligibleReason,
      trigger: {
        failingCheckName: eligibility.triggerCheckName,
        governanceErrorCode: eligibility.triggerGovernanceErrorCode
      },
      retryContext: {
        consumed: false,
        retriableErrorCode: eligibility.triggerErrorCode
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
      finalStatus: normalized.ciStatus === 'passed' ? 'passed' : 'failed'
    }
  });

  return {
    normalized,
    eligibility,
    report,
    reportJson: canonicalStringify(report)
  };
}

describe('ci normalization integration fixtures', () => {
  it('multi-fail-one-governance: governance governs and allowlisted code is retry-eligible', () => {
    const scenario = buildScenarioReport('multi-fail-one-governance');

    expect(scenario.normalized.governingFailure?.name).toBe('governance');
    expect(scenario.normalized.governingFailure?.classification).toBe('governance');
    expect(scenario.normalized.governingFailure?.extracted.governanceErrorCode).toBe('MISSING_TIER_LABEL');
    expect(scenario.eligibility.eligible).toBe(true);
    expect(scenario.eligibility.ineligibleReason).toBeNull();
    expect(scenario.reportJson).toBe(fs.readFileSync(snapshotPath('multi-fail-one-governance'), 'utf8').trim());
  });

  it('gov-and-non-gov: governance governs but retry blocked for non-retriable code', () => {
    const scenario = buildScenarioReport('gov-and-non-gov');

    expect(scenario.normalized.governingFailure?.name).toBe('governance');
    expect(scenario.normalized.governingFailure?.classification).toBe('governance');
    expect(scenario.normalized.governingFailure?.extracted.governanceErrorCode).toBe('SOME_NEW_ERROR');
    expect(scenario.eligibility.eligible).toBe(false);
    expect(scenario.eligibility.ineligibleReason).toBe('ERROR_CODE_NOT_RETRIABLE');
    expect(scenario.reportJson).toBe(fs.readFileSync(snapshotPath('gov-and-non-gov'), 'utf8').trim());
  });

  it('only-non-gov: no retry when governing failure is non-governance', () => {
    const scenario = buildScenarioReport('only-non-gov');

    expect(scenario.normalized.governingFailure?.classification).toBe('non_governance');
    expect(scenario.eligibility.eligible).toBe(false);
    expect(scenario.eligibility.ineligibleReason).toBe('NON_GOVERNANCE_GOVERNING_FAILURE');
    expect(scenario.reportJson).toBe(fs.readFileSync(snapshotPath('only-non-gov'), 'utf8').trim());
  });

  it('passed: CI passed and local preflight failure does not trigger retry', () => {
    const scenario = buildScenarioReport('passed');

    expect(scenario.normalized.ciStatus).toBe('passed');
    expect(scenario.eligibility.eligible).toBe(false);
    expect(scenario.eligibility.ineligibleReason).toBe('CI_PASSED');
    expect(scenario.reportJson).toBe(fs.readFileSync(snapshotPath('passed'), 'utf8').trim());
  });

  it('unknown: partial CI state is unknown and retry-ineligible', () => {
    const scenario = buildScenarioReport('unknown');

    expect(scenario.normalized.ciStatus).toBe('unknown');
    expect(scenario.normalized.governingFailure).toBeNull();
    expect(scenario.eligibility.eligible).toBe(false);
    expect(scenario.eligibility.ineligibleReason).toBe('CI_UNKNOWN');
    expect(scenario.reportJson).toBe(fs.readFileSync(snapshotPath('unknown'), 'utf8').trim());
  });
});
