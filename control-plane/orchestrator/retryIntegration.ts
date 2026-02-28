import { parsePrBodyForGovernance } from '../pr-body/evidence-parse.ts';
import { mutationKernel } from '../pr/mutationKernel.ts';
import { evaluateRetryEligibilityForNormalizedCi } from './ci/retry-eligibility.ts';
import { normalizeCi } from './ci/normalize.ts';
import type { NormalizedCiSummary, RawCheck } from './ci/types.ts';
import { applyPatchPlan } from './retry/patchApplier.ts';
import { buildPatchPlan, stableSortLabels } from './retry/patchPlanner.ts';
import type { PatchOp, PatchPlan } from './retry/patchTypes.ts';

type CommandRunner = (args: string[]) => Promise<{ code: number; stdout: string; stderr: string }>;
type WriteFile = (path: string, body: string) => void;

const METADATA_REFRESH_COMMIT_MESSAGE = 'chore: governance metadata refresh';

const STRICT_RETRYABLE_CODES = [
  'MISSING_TIER_LABEL',
  'MISSING_APPROVAL_LABEL',
  'MISSING_TIER_3_APPROVED',
  'MISSING_EVIDENCE_BLOCK',
  'MISSING_EVIDENCE_FIELDS',
  'MISSING_EVIDENCE_FIELD',
  'INVALID_BODY_FORMAT'
] as const;

type RetryReasonCode =
  | 'retry_applied'
  | 'ci_passed'
  | 'ci_unknown'
  | 'mode_not_autonomous'
  | 'retry_already_consumed'
  | 'no_governing_failure'
  | 'non_governance_governing_failure'
  | 'missing_governance_error_code'
  | 'error_code_not_retry_eligible'
  | 'patch_plan_noop'
  | 'patch_apply_failed'
  | 'label_apply_failed'
  | 'metadata_refresh_failed';

export type RetryIntegrationArgs = {
  executionMode: 'structured' | 'autonomous';
  ciResult: NormalizedCiSummary | RawCheck[];
  prNumber: number;
  currentPrBody: string;
  currentLabels: string[];
  requiredTier?: number | null;
  requiredTierLabel?: string | null;
  dryRun: boolean;
  gh: CommandRunner;
  git: CommandRunner;
  writeFile?: WriteFile;
};

export type RetryIntegrationResult = {
  retryAttempted: boolean;
  retryEligible: boolean;
  retryReason: RetryReasonCode;
  patchId: string | null;
  metadataRefreshed: boolean;
  appliedMutations: {
    bodyUpdated: boolean;
    labelsUpdated: boolean;
    emptyCommitRefresh: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
  patchPlan?: PatchPlan | null;
  patchAppliedOps?: PatchOp[];
  patchCommands?: string[];
};

type EligibilityEvaluation = {
  eligible: boolean;
  reason: RetryReasonCode;
  normalizedCi: NormalizedCiSummary;
  governanceErrorCode: string | null;
};

function normalizeTierLabel(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const match = value.trim().toLowerCase().match(/^tier-([0-3])$/);
  if (!match) {
    return null;
  }
  return `tier-${match[1]}`;
}

function resolveTierLabel(args: {
  currentPrBody: string;
  requiredTier?: number | null;
  requiredTierLabel?: string | null;
}): string {
  const parsed = parsePrBodyForGovernance(args.currentPrBody);
  const fromBody = normalizeTierLabel(parsed.tierLine);
  if (fromBody) {
    return fromBody;
  }

  const fromRequiredLabel = normalizeTierLabel(args.requiredTierLabel);
  if (fromRequiredLabel) {
    return fromRequiredLabel;
  }

  const tier = args.requiredTier;
  if (tier === 0 || tier === 1 || tier === 2 || tier === 3) {
    return `tier-${tier}`;
  }

  return 'tier-0';
}

function toNormalizedCi(ciResult: NormalizedCiSummary | RawCheck[]): NormalizedCiSummary {
  if (Array.isArray(ciResult)) {
    return normalizeCi(ciResult);
  }
  return ciResult;
}

export function detectRetryAttemptInEvidence(body: string): boolean {
  const parsed = parsePrBodyForGovernance(body);
  return typeof parsed.kv['retry-attempt'] === 'string' && parsed.kv['retry-attempt'].trim().length > 0;
}

export function insertRetryAttemptInEvidence(body: string): string {
  const parsed = parsePrBodyForGovernance(body);
  const desiredTier = normalizeTierLabel(parsed.tierLine) ?? 'tier-0';
  return mutationKernel({
    currentBody: body,
    currentLabels: [],
    desiredTier,
    retryAttempt: 1
  }).newBody;
}

function isStrictRetryableGovernanceCode(value: string | null): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toUpperCase();
  return STRICT_RETRYABLE_CODES.includes(normalized as (typeof STRICT_RETRYABLE_CODES)[number]);
}

function evaluateEligibility(args: {
  executionMode: 'structured' | 'autonomous';
  ciResult: NormalizedCiSummary | RawCheck[];
  currentPrBody: string;
}): EligibilityEvaluation {
  const normalizedCi = toNormalizedCi(args.ciResult);
  const alreadyRetried = detectRetryAttemptInEvidence(args.currentPrBody);
  const baseline = evaluateRetryEligibilityForNormalizedCi({
    executionMode: args.executionMode,
    ci: normalizedCi,
    retryState: {
      retryEnabled: true,
      retryCount: alreadyRetried ? 1 : 0,
      retryAttempted: alreadyRetried,
      triggerErrorCode: null,
      finalStatus: 'pending'
    }
  });

  if (baseline.ineligibleReason === 'CI_PASSED') {
    return { eligible: false, reason: 'ci_passed', normalizedCi, governanceErrorCode: null };
  }
  if (baseline.ineligibleReason === 'CI_UNKNOWN') {
    return { eligible: false, reason: 'ci_unknown', normalizedCi, governanceErrorCode: null };
  }
  if (baseline.ineligibleReason === 'MODE_NOT_AUTONOMOUS') {
    return { eligible: false, reason: 'mode_not_autonomous', normalizedCi, governanceErrorCode: null };
  }
  if (baseline.ineligibleReason === 'RETRY_ALREADY_CONSUMED') {
    return { eligible: false, reason: 'retry_already_consumed', normalizedCi, governanceErrorCode: null };
  }
  if (baseline.ineligibleReason === 'NO_GOVERNING_FAILURE') {
    return { eligible: false, reason: 'no_governing_failure', normalizedCi, governanceErrorCode: null };
  }
  if (baseline.ineligibleReason === 'NON_GOVERNANCE_GOVERNING_FAILURE') {
    return { eligible: false, reason: 'non_governance_governing_failure', normalizedCi, governanceErrorCode: null };
  }
  if (baseline.ineligibleReason === 'MISSING_GOVERNANCE_ERROR_CODE') {
    return { eligible: false, reason: 'missing_governance_error_code', normalizedCi, governanceErrorCode: null };
  }

  const governanceErrorCode = normalizedCi.governingFailure?.extracted.governanceErrorCode ?? null;
  if (!isStrictRetryableGovernanceCode(governanceErrorCode)) {
    return { eligible: false, reason: 'error_code_not_retry_eligible', normalizedCi, governanceErrorCode };
  }

  return {
    eligible: true,
    reason: 'retry_applied',
    normalizedCi,
    governanceErrorCode
  };
}

function toLabelCommands(prNumber: number, labels: string[]): string[] {
  return labels.map((label) => `gh pr edit ${prNumber} --add-label "${label}"`);
}

function extractAddLabelOps(plan: PatchPlan): string[] {
  return stableSortLabels(
    plan.ops
      .filter((entry): entry is Extract<PatchOp, { op: 'add_label' }> => entry.op === 'add_label')
      .map((entry) => entry.label)
  );
}

function hasActionableOps(plan: PatchPlan): boolean {
  return plan.ops.some((entry) => entry.op !== 'noop');
}

export async function runRetryIntegration(args: RetryIntegrationArgs): Promise<RetryIntegrationResult> {
  const eligibility = evaluateEligibility({
    executionMode: args.executionMode,
    ciResult: args.ciResult,
    currentPrBody: args.currentPrBody
  });

  if (!eligibility.eligible || !eligibility.governanceErrorCode) {
    return {
      retryAttempted: false,
      retryEligible: false,
      retryReason: eligibility.reason,
      patchId: null,
      metadataRefreshed: false,
      appliedMutations: {
        bodyUpdated: false,
        labelsUpdated: false,
        emptyCommitRefresh: false
      },
      patchPlan: null,
      patchAppliedOps: [],
      patchCommands: []
    };
  }

  const patchPlan = buildPatchPlan({
    retryAttempt: 0,
    governanceErrorCode: eligibility.governanceErrorCode,
    governanceClassification: 'governance',
    requiredTier: args.requiredTier,
    requiredTierLabel: args.requiredTierLabel
  });

  if (!hasActionableOps(patchPlan)) {
    return {
      retryAttempted: false,
      retryEligible: true,
      retryReason: 'patch_plan_noop',
      patchId: patchPlan.patchId ?? null,
      metadataRefreshed: false,
      appliedMutations: {
        bodyUpdated: false,
        labelsUpdated: false,
        emptyCommitRefresh: false
      },
      patchPlan,
      patchAppliedOps: [],
      patchCommands: []
    };
  }

  const desiredTier = resolveTierLabel({
    currentPrBody: args.currentPrBody,
    requiredTier: args.requiredTier,
    requiredTierLabel: args.requiredTierLabel
  });
  const allowedLabelMutations = extractAddLabelOps(patchPlan);
  const mutation = mutationKernel({
    currentBody: args.currentPrBody,
    currentLabels: args.currentLabels,
    desiredTier,
    retryAttempt: 1,
    allowedLabelMutations
  });

  const bodyPlan: PatchPlan = {
    ...patchPlan,
    ops: mutation.bodyChanged
      ? [{ op: 'set_pr_body', body: mutation.newBody }]
      : [{ op: 'noop', reason: 'body_already_canonical' }]
  };

  const patchApply = await applyPatchPlan({
    prNumber: args.prNumber,
    plan: bodyPlan,
    dryRun: args.dryRun,
    gh: args.gh,
    git: args.git,
    writeFile: args.writeFile
  });

  if (patchApply.outcome === 'failed') {
    return {
      retryAttempted: true,
      retryEligible: true,
      retryReason: 'patch_apply_failed',
      patchId: patchPlan.patchId ?? null,
      metadataRefreshed: false,
      appliedMutations: {
        bodyUpdated: false,
        labelsUpdated: false,
        emptyCommitRefresh: false
      },
      patchPlan,
      patchAppliedOps: patchApply.appliedOps,
      patchCommands: patchApply.commands,
      error: {
        code: 'patch_apply_failed',
        message: patchApply.failureReason ?? 'Patch applier returned failure.'
      }
    };
  }

  const currentLabelSet = new Set(stableSortLabels(args.currentLabels));
  const labelTargets = mutation.newLabels.filter((label) => !currentLabelSet.has(label));
  const labelCommands = toLabelCommands(args.prNumber, labelTargets);
  const labelAppliedOps: PatchOp[] = [];

  if (!args.dryRun) {
    for (const label of labelTargets) {
      const labelResult = await args.gh(['pr', 'edit', String(args.prNumber), '--add-label', label]);
      if (labelResult.code !== 0) {
        return {
          retryAttempted: true,
          retryEligible: true,
          retryReason: 'label_apply_failed',
          patchId: patchPlan.patchId ?? null,
          metadataRefreshed: false,
          appliedMutations: {
            bodyUpdated: patchApply.appliedOps.some((entry) => entry.op === 'set_pr_body'),
            labelsUpdated: labelAppliedOps.length > 0,
            emptyCommitRefresh: false
          },
          patchPlan,
          patchAppliedOps: [...patchApply.appliedOps, ...labelAppliedOps],
          patchCommands: [...patchApply.commands, ...labelCommands],
          error: {
            code: 'label_apply_failed',
            message: `Failed to apply label: ${label}`
          }
        };
      }
      labelAppliedOps.push({ op: 'add_label', label });
    }
  }

  const bodyUpdated = patchApply.appliedOps.some((entry) => entry.op === 'set_pr_body');
  const labelsUpdated = mutation.labelsChanged;
  const refreshRequired = mutation.requiresMetadataRefresh;
  let metadataRefreshed = false;

  if (refreshRequired && !args.dryRun) {
    const commit = await args.git(['commit', '--allow-empty', '-m', METADATA_REFRESH_COMMIT_MESSAGE]);
    if (commit.code !== 0) {
      return {
        retryAttempted: true,
        retryEligible: true,
        retryReason: 'metadata_refresh_failed',
        patchId: patchPlan.patchId ?? null,
        metadataRefreshed: false,
        appliedMutations: {
          bodyUpdated,
          labelsUpdated,
          emptyCommitRefresh: false
        },
        patchPlan,
        patchAppliedOps: [...patchApply.appliedOps, ...labelAppliedOps],
        patchCommands: [
          ...patchApply.commands,
          ...labelCommands,
          `git commit --allow-empty -m "${METADATA_REFRESH_COMMIT_MESSAGE}"`,
          'git push'
        ],
        error: {
          code: 'metadata_refresh_failed',
          message: 'git_failed:commit'
        }
      };
    }

    const push = await args.git(['push']);
    if (push.code !== 0) {
      return {
        retryAttempted: true,
        retryEligible: true,
        retryReason: 'metadata_refresh_failed',
        patchId: patchPlan.patchId ?? null,
        metadataRefreshed: false,
        appliedMutations: {
          bodyUpdated,
          labelsUpdated,
          emptyCommitRefresh: false
        },
        patchPlan,
        patchAppliedOps: [...patchApply.appliedOps, ...labelAppliedOps],
        patchCommands: [
          ...patchApply.commands,
          ...labelCommands,
          `git commit --allow-empty -m "${METADATA_REFRESH_COMMIT_MESSAGE}"`,
          'git push'
        ],
        error: {
          code: 'metadata_refresh_failed',
          message: 'git_failed:push'
        }
      };
    }

    metadataRefreshed = true;
  }

  return {
    retryAttempted: true,
    retryEligible: true,
    retryReason: 'retry_applied',
    patchId: patchPlan.patchId ?? null,
    metadataRefreshed,
    appliedMutations: {
      bodyUpdated,
      labelsUpdated,
      emptyCommitRefresh: metadataRefreshed
    },
    patchPlan,
    patchAppliedOps: [...patchApply.appliedOps, ...labelAppliedOps],
    patchCommands: [
      ...patchApply.commands,
      ...labelCommands,
      ...(refreshRequired
        ? [
          `git commit --allow-empty -m "${METADATA_REFRESH_COMMIT_MESSAGE}"`,
          'git push'
        ]
        : [])
    ]
  };
}
