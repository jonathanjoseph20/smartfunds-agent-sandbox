import { classifyIsolation, type ClassifyIsolationArgs } from './isolation/path-classifier.ts';
import type { IsolationClassification } from './isolation/types.ts';

export const ISOLATION_REMEDIATION_ACTION =
  'Autonomous contexts (swarm/*) must not touch structured paths; move change to structured branch or restrict task to autonomous paths.';

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function buildIsolationErrorMessage(classification: IsolationClassification): string {
  const statusCode = `isolation_violation:${classification.isolationStatus}`;
  if (classification.isolationStatus === 'invalid_autonomous_branch_namespace') {
    return `${statusCode}: swarm branch must match swarm/<task> where <task> is [a-z0-9._-]+.`;
  }

  const structuredPaths = sortedUnique(classification.structuredPathsTouched);
  return `${statusCode}: autonomous context may not modify structured paths: ${structuredPaths.join(', ')}`;
}

export function buildIsolationEnforcement(args: {
  branchName: string;
  changedFiles: string[];
  executionMode: 'structured' | 'autonomous' | 'unknown';
}): {
  classification: IsolationClassification;
  errors: string[];
  nextActions: string[];
} {
  const classifyArgs: ClassifyIsolationArgs = {
    branchName: args.branchName,
    changedFiles: args.changedFiles,
    executionMode: args.executionMode
  };
  const classification = classifyIsolation(classifyArgs);

  if (!classification.autonomousContextDetected || classification.isolationStatus === 'ok') {
    return {
      classification,
      errors: [],
      nextActions: []
    };
  }

  return {
    classification,
    errors: [buildIsolationErrorMessage(classification)],
    nextActions: [ISOLATION_REMEDIATION_ACTION]
  };
}
