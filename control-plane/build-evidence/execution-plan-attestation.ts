import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import type { BuildExecutionRun } from '../build-runtime/build-execution-types.ts';

import { deriveExecutionPlanAttestationId } from './build-evidence-identity.ts';
import type { BuildEvidenceBundle, ExecutionPlanAttestation } from './build-evidence-types.ts';

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

function deriveExecutionPlanHash(run: Pick<BuildExecutionRun, 'executionPlan'>): string {
  return sha256(canonicalStringify({
    executionPlan: {
      steps: [...run.executionPlan.steps]
        .map((step) => ({
          stepId: step.stepId,
          operationType: step.operationType,
          targetPath: normalizePath(step.targetPath),
          promptTemplate: step.promptTemplate,
          expectedArtifacts: [...step.expectedArtifacts].sort((left, right) => left.localeCompare(right)),
        }))
        .sort((left, right) => left.stepId.localeCompare(right.stepId)),
    },
  }));
}

function toState(attestationClass: ExecutionPlanAttestation['attestationClass']): ExecutionPlanAttestation['state'] {
  if (attestationClass === 'execution_plan_verified') {
    return 'verified';
  }
  if (attestationClass === 'execution_plan_mismatch') {
    return 'failed';
  }
  if (attestationClass === 'execution_plan_partial') {
    return 'blocked';
  }
  return 'inconclusive';
}

export function attestBuildEvidenceExecutionPlan(input: {
  bundle: Pick<BuildEvidenceBundle, 'buildEvidenceBundleId' | 'runId' | 'executionPlanHash'>;
  run: Pick<BuildExecutionRun, 'executionPlan'>;
  expectedExecutionPlanHash?: string;
}): ExecutionPlanAttestation {
  if (input.run.executionPlan.steps.length === 0) {
    const attestationClass = 'execution_plan_inconclusive' as const;
    const reasonTokens = ['execution_plan_missing'];

    return {
      executionPlanAttestationId: deriveExecutionPlanAttestationId({
        buildEvidenceBundleId: input.bundle.buildEvidenceBundleId,
        runId: input.bundle.runId,
        executionPlanHash: input.bundle.executionPlanHash,
        attestationClass,
        reasonTokens,
      }),
      buildEvidenceBundleId: input.bundle.buildEvidenceBundleId,
      runId: input.bundle.runId,
      executionPlanHash: input.bundle.executionPlanHash,
      attestationClass,
      reasonTokens,
      state: toState(attestationClass),
    };
  }

  const actualHash = deriveExecutionPlanHash(input.run);
  const expectedHash = input.expectedExecutionPlanHash ?? actualHash;

  const attestationClass = input.bundle.executionPlanHash === expectedHash
    ? 'execution_plan_verified' as const
    : input.bundle.executionPlanHash === actualHash
      ? 'execution_plan_partial' as const
      : 'execution_plan_mismatch' as const;

  const reasonTokens = attestationClass === 'execution_plan_verified'
    ? ['execution_plan_verified']
    : attestationClass === 'execution_plan_partial'
      ? ['execution_plan_expected_hash_missing_or_divergent']
      : ['execution_plan_hash_mismatch'];

  return {
    executionPlanAttestationId: deriveExecutionPlanAttestationId({
      buildEvidenceBundleId: input.bundle.buildEvidenceBundleId,
      runId: input.bundle.runId,
      executionPlanHash: input.bundle.executionPlanHash,
      attestationClass,
      reasonTokens,
    }),
    buildEvidenceBundleId: input.bundle.buildEvidenceBundleId,
    runId: input.bundle.runId,
    executionPlanHash: input.bundle.executionPlanHash,
    attestationClass,
    reasonTokens,
    state: toState(attestationClass),
  };
}
