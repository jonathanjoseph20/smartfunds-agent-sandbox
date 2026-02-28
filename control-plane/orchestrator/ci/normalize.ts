import { extractGovernanceError } from './extract-governance-error.ts';
import { isFailureConclusion, selectGoverningFailure } from './select-governing-failure.ts';
import {
  GOVERNANCE_CHECK_NAME_ALLOWLIST,
  type CheckClassification,
  type NormalizedCheck,
  type NormalizedCiSummary,
  type RawCheck
} from './types.ts';

function normalizeName(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  return trimmed.length > 0 ? trimmed : 'unknown-check';
}

function normalizeConclusion(raw: RawCheck): NormalizedCheck['conclusion'] {
  const value = (raw.conclusion ?? raw.state ?? raw.status ?? '').trim().toUpperCase();

  if (value === 'SUCCESS') {
    return 'success';
  }
  if (value === 'FAILURE' || value === 'FAILED' || value === 'ERROR') {
    return 'failure';
  }
  if (value === 'CANCELLED') {
    return 'cancelled';
  }
  if (value === 'SKIPPED') {
    return 'skipped';
  }
  if (value === 'NEUTRAL') {
    return 'neutral';
  }
  if (value === 'TIMED_OUT') {
    return 'timed_out';
  }
  if (value === 'ACTION_REQUIRED') {
    return 'action_required';
  }

  return 'unknown';
}

function classifyGovernance(name: string, raw: RawCheck): CheckClassification {
  const normalizedName = name.toLowerCase();
  const summary = (raw.output?.summary ?? '').toLowerCase();
  const text = (raw.output?.text ?? '').toLowerCase();

  if (GOVERNANCE_CHECK_NAME_ALLOWLIST.includes(normalizedName as (typeof GOVERNANCE_CHECK_NAME_ALLOWLIST)[number])) {
    return 'governance';
  }

  if (normalizedName.includes('governance') || normalizedName.includes('pr-body')) {
    return 'governance';
  }

  if (summary.includes('governance_report_json_start') || text.includes('governance_report_json_start')) {
    return 'governance';
  }

  if (name === 'unknown-check') {
    return 'unknown';
  }

  return 'non_governance';
}

function sortByName(left: NormalizedCheck, right: NormalizedCheck): number {
  return left.name.localeCompare(right.name);
}

function isAmbiguous(rawChecks: RawCheck[], checks: NormalizedCheck[]): boolean {
  if (rawChecks.length === 0 || checks.length === 0) {
    return true;
  }

  if (rawChecks.some((raw) => (raw.name ?? '').trim().length === 0)) {
    return true;
  }

  return checks.some((check) => check.conclusion === 'unknown');
}

export function normalizeCi(rawChecks: RawCheck[]): NormalizedCiSummary {
  const checks = rawChecks
    .map((raw) => {
      const name = normalizeName(raw.name);
      const conclusion = normalizeConclusion(raw);
      const classification = classifyGovernance(name, raw);
      const base: NormalizedCheck = {
        name,
        conclusion,
        classification,
        extracted: {
          governanceErrorCode: null,
          governanceErrorJson: null
        }
      };

      return {
        ...base,
        extracted: extractGovernanceError(base, raw)
      };
    })
    .sort(sortByName);

  const failedChecks = checks.filter((check) => isFailureConclusion(check.conclusion)).sort(sortByName);

  if (isAmbiguous(rawChecks, checks)) {
    return {
      ciStatus: 'unknown',
      checks,
      failedChecks,
      governingFailure: null,
      governingReason: 'CI_STATUS_UNKNOWN'
    };
  }

  if (failedChecks.length > 0) {
    const selection = selectGoverningFailure(checks);
    return {
      ciStatus: 'failed',
      checks,
      failedChecks,
      governingFailure: selection.governingFailure,
      governingReason: selection.reason
    };
  }

  const allPassingLike = checks.every((check) =>
    check.conclusion === 'success' || check.conclusion === 'skipped' || check.conclusion === 'neutral'
  );

  if (!allPassingLike) {
    return {
      ciStatus: 'unknown',
      checks,
      failedChecks,
      governingFailure: null,
      governingReason: 'CI_STATUS_UNKNOWN'
    };
  }

  return {
    ciStatus: 'passed',
    checks,
    failedChecks,
    governingFailure: null,
    governingReason: null
  };
}
