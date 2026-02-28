import type {
  IsolationClassification,
  IsolationStatus,
  IsolationViolationCode
} from './types.ts';

export interface ClassifyIsolationArgs {
  branchName: string;
  changedFiles: string[];
  executionMode?: 'structured' | 'autonomous' | 'unknown';
}

const STRUCTURED_PREFIXES = [
  'control-plane/',
  'control-plane/governance/',
  'control-plane/entities/',
  'control-plane/finance/',
  'control-plane/projects/',
  '.github/'
] as const;

const AUTONOMOUS_PREFIXES = ['docs/', 'frontend/', 'marketing/', 'agent-ui/'] as const;
const RAIL_REGISTRY_PATH = 'control-plane/entities/rails.json';

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function startsWithAny(path: string, prefixes: readonly string[]): boolean {
  for (const prefix of prefixes) {
    if (path.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

function isValidSwarmBranch(branchName: string): boolean {
  if (!branchName.startsWith('swarm/')) {
    return false;
  }

  const suffix = branchName.slice('swarm/'.length);
  if (suffix.length === 0) {
    return false;
  }

  for (let index = 0; index < suffix.length; index += 1) {
    const ch = suffix[index];
    const isAllowed =
      (ch >= 'a' && ch <= 'z') ||
      (ch >= '0' && ch <= '9') ||
      ch === '.' ||
      ch === '_' ||
      ch === '-';
    if (!isAllowed) {
      return false;
    }
  }

  return true;
}

function hasPath(paths: string[], expectedPath: string): boolean {
  return paths.some((value) => value === expectedPath);
}

export function classifyIsolation(args: ClassifyIsolationArgs): IsolationClassification {
  const changedFiles = sortedUnique(args.changedFiles);
  const autonomousContextDetected =
    args.branchName.startsWith('swarm/') || args.executionMode === 'autonomous';
  const branchNamespaceValid = args.branchName.startsWith('swarm/')
    ? isValidSwarmBranch(args.branchName)
    : true;

  const structuredPathsTouched = sortedUnique(
    changedFiles.filter((path) => startsWithAny(path, STRUCTURED_PREFIXES))
  );
  const autonomousPathsTouched = sortedUnique(
    changedFiles.filter((path) => startsWithAny(path, AUTONOMOUS_PREFIXES))
  );

  const violations: IsolationViolationCode[] = [];
  let isolationStatus: IsolationStatus = 'ok';

  if (autonomousContextDetected && args.branchName.startsWith('swarm/') && !branchNamespaceValid) {
    isolationStatus = 'invalid_autonomous_branch_namespace';
    violations.push('invalid_branch_namespace');
  }

  if (autonomousContextDetected && structuredPathsTouched.length > 0) {
    const touchesGovernanceCore = structuredPathsTouched.some((path) =>
      path.startsWith('control-plane/governance/')
    );
    const touchesFinanceCore = structuredPathsTouched.some((path) =>
      path.startsWith('control-plane/finance/')
    );
    const touchesEntityRegistry = structuredPathsTouched.some((path) =>
      path.startsWith('control-plane/entities/')
    );
    const touchesRailRegistry = hasPath(structuredPathsTouched, RAIL_REGISTRY_PATH);

    violations.push('structured_path_in_autonomous_context');

    if (touchesGovernanceCore) {
      isolationStatus = 'autonomous_governance_core_mutation';
      violations.push('governance_core_mutation_attempt');
    } else if (touchesFinanceCore) {
      isolationStatus = 'autonomous_financial_core_mutation';
      violations.push('financial_core_mutation_attempt');
    } else if (touchesRailRegistry) {
      isolationStatus = 'autonomous_rail_registry_mutation';
      violations.push('rail_registry_mutation_attempt');
    } else if (touchesEntityRegistry) {
      isolationStatus = 'autonomous_entity_registry_mutation';
      violations.push('entity_registry_mutation_attempt');
    } else {
      isolationStatus = 'autonomous_structured_violation';
    }
  }

  return {
    autonomousContextDetected,
    branchNamespaceValid,
    structuredPathsTouched,
    autonomousPathsTouched,
    isolationStatus,
    isolationViolations: sortedUnique(violations)
  };
}
