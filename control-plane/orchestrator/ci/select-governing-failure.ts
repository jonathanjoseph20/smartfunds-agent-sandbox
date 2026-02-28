import { GOVERNANCE_CHECK_PRIORITY, type GoverningReason, type NormalizedCheck } from './types.ts';

function isFailureLike(check: NormalizedCheck): boolean {
  return check.conclusion === 'failure' || check.conclusion === 'timed_out' || check.conclusion === 'action_required';
}

function findPriorityIndex(name: string): number {
  const normalizedName = name.trim().toLowerCase();
  const index = GOVERNANCE_CHECK_PRIORITY.findIndex((candidate) => candidate === normalizedName);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function sortByName(left: NormalizedCheck, right: NormalizedCheck): number {
  return left.name.localeCompare(right.name);
}

function pickGovernanceFailure(checks: NormalizedCheck[]): NormalizedCheck {
  const sorted = [...checks].sort((left, right) => {
    const leftPriority = findPriorityIndex(left.name);
    const rightPriority = findPriorityIndex(right.name);
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    return sortByName(left, right);
  });

  return sorted[0];
}

export function selectGoverningFailure(checks: NormalizedCheck[]): {
  governingFailure: NormalizedCheck | null;
  reason: GoverningReason;
} {
  const failed = checks.filter(isFailureLike);

  if (failed.length === 0) {
    return {
      governingFailure: null,
      reason: 'NO_FAILED_CHECKS'
    };
  }

  const failedGovernance = failed.filter((check) => check.classification === 'governance');
  if (failedGovernance.length > 0) {
    return {
      governingFailure: pickGovernanceFailure(failedGovernance),
      reason: failedGovernance.length > 1
        ? 'MULTIPLE_GOVERNANCE_FAILURES_PICKED_FIRST'
        : 'GOVERNANCE_FAILURE_PRESENT'
    };
  }

  const failedNonGovernance = failed
    .filter((check) => check.classification === 'non_governance')
    .sort(sortByName);

  if (failedNonGovernance.length > 0) {
    return {
      governingFailure: failedNonGovernance[0],
      reason: 'ONLY_NON_GOVERNANCE_FAILURES'
    };
  }

  return {
    governingFailure: null,
    reason: 'NO_FAILED_CHECKS'
  };
}

export function isFailureConclusion(conclusion: NormalizedCheck['conclusion']): boolean {
  return conclusion === 'failure' || conclusion === 'timed_out' || conclusion === 'action_required';
}
