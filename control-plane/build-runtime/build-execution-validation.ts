import type { CodexExecutionPacketManager } from '../codex/codex-execution-packet-manager.ts';
import type { RepoScaffoldManager } from '../repo-scaffold/repo-scaffold-manager.ts';

import { validateExpectedArtifacts } from './build-execution-artifacts.ts';
import type {
  BuildExecutionRun,
  ExecutionStep,
  OperationType,
  ValidationResult,
} from './build-execution-types.ts';

const OPERATION_TYPES: OperationType[] = [
  'generateFile',
  'modifyFile',
  'appendFile',
  'generateTest',
  'generateDocs',
  'generateConfig',
];

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

function isOperationType(value: string): value is OperationType {
  return OPERATION_TYPES.includes(value as OperationType);
}

function validateStepOrdering(steps: ExecutionStep[]): string[] {
  const violations: string[] = [];
  const sortedByStepId = [...steps].sort((left, right) => left.stepId.localeCompare(right.stepId));

  for (let index = 0; index < steps.length; index += 1) {
    if (steps[index]!.stepId !== sortedByStepId[index]!.stepId) {
      violations.push('executionPlan_steps_not_deterministically_sorted');
      break;
    }
  }

  return violations;
}

export function validateBuildExecutionRun(input: {
  run: Partial<BuildExecutionRun>;
  packetManager: Pick<CodexExecutionPacketManager, 'getCodexExecutionPacket'>;
  scaffoldManager: Pick<RepoScaffoldManager, 'getRepoScaffoldBundle'>;
}): ValidationResult {
  const missingFields: string[] = [];
  const violations: string[] = [];
  const warnings: string[] = [];

  if (!input.run.packetId?.trim()) {
    missingFields.push('packetId');
  }
  if (!input.run.bundleId?.trim()) {
    missingFields.push('bundleId');
  }
  if (!input.run.graphId?.trim()) {
    missingFields.push('graphId');
  }
  if (!input.run.taskId?.trim()) {
    missingFields.push('taskId');
  }
  if (!input.run.repoTarget?.trim()) {
    missingFields.push('repoTarget');
  }
  if (!input.run.executionPlan) {
    missingFields.push('executionPlan');
  }

  let packet: { packetId: string; graphId: string; taskId: string; promptTemplate: string } | null = null;
  if (input.run.packetId?.trim()) {
    try {
      packet = input.packetManager.getCodexExecutionPacket(input.run.packetId);
    } catch {
      violations.push(`packet_not_found:${input.run.packetId}`);
    }
  }

  let bundle: { bundleId: string; packetId: string; graphId: string; taskId: string; repoTarget: string } | null = null;
  if (input.run.bundleId?.trim()) {
    try {
      bundle = input.scaffoldManager.getRepoScaffoldBundle(input.run.bundleId);
    } catch {
      violations.push(`bundle_not_found:${input.run.bundleId}`);
    }
  }

  if (packet && bundle) {
    if (bundle.packetId !== packet.packetId) {
      violations.push('bundle_packet_mismatch');
    }
    if (input.run.graphId && input.run.graphId !== packet.graphId) {
      violations.push('graphId_mismatch_with_packet');
    }
    if (input.run.graphId && input.run.graphId !== bundle.graphId) {
      violations.push('graphId_mismatch_with_bundle');
    }
    if (input.run.taskId && input.run.taskId !== packet.taskId) {
      violations.push('taskId_mismatch_with_packet');
    }
    if (input.run.taskId && input.run.taskId !== bundle.taskId) {
      violations.push('taskId_mismatch_with_bundle');
    }
    if (input.run.repoTarget && normalizePath(input.run.repoTarget) !== normalizePath(bundle.repoTarget)) {
      violations.push('repoTarget_mismatch_with_bundle');
    }
  }

  const steps = input.run.executionPlan?.steps ?? [];
  if (steps.length === 0) {
    missingFields.push('executionPlan.steps');
  }

  violations.push(...validateStepOrdering(steps));

  for (const step of steps) {
    if (!step.stepId.trim()) {
      violations.push('step_missing_stepId');
    }
    if (!step.targetPath.trim()) {
      violations.push(`step_missing_targetPath:${step.stepId || 'unknown'}`);
    }
    if (!step.promptTemplate.trim()) {
      violations.push(`step_missing_promptTemplate:${step.stepId || 'unknown'}`);
    }
    if (!isOperationType(step.operationType)) {
      violations.push(`step_invalid_operationType:${step.stepId || 'unknown'}`);
    }
    if (step.expectedArtifacts.length === 0) {
      violations.push(`step_expectedArtifacts_empty:${step.stepId || 'unknown'}`);
    }
  }

  const artifactValidation = validateExpectedArtifacts({
    steps,
    generatedArtifacts: input.run.generatedArtifacts ?? [],
  });

  warnings.push(...artifactValidation.warnings);
  if ((input.run.generatedArtifacts ?? []).length > 0) {
    violations.push(...artifactValidation.violations);
  }

  const sortedMissing = uniqueSorted(missingFields);
  const sortedViolations = uniqueSorted(violations);
  const sortedWarnings = uniqueSorted(warnings);

  if (sortedMissing.length > 0 || sortedViolations.length > 0) {
    return {
      validationState: 'invalid',
      missingFields: sortedMissing,
      violations: sortedViolations,
      warnings: sortedWarnings,
    };
  }

  if (sortedWarnings.length > 0) {
    return {
      validationState: 'warning',
      missingFields: sortedMissing,
      violations: sortedViolations,
      warnings: sortedWarnings,
    };
  }

  return {
    validationState: 'valid',
    missingFields: sortedMissing,
    violations: sortedViolations,
    warnings: sortedWarnings,
  };
}
