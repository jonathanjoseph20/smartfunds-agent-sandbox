import { loadProjectsFromDir } from '../studio/registry.ts';
import { loadSwarmsFromDir } from './registry.ts';
import { evaluateSwarmOrchestrationContracts } from './orchestration.ts';
import { loadOrchestrationRegistryFromFile } from './orchestration-registry.ts';
import type { OrchestrationPhase } from './orchestration-schema.ts';
import type { SwarmDefinition } from './types.ts';

const DEFAULT_REGISTRY_PATH = 'control-plane/swarms/orchestration.json';
const DEFAULT_PROJECTS_DIR = 'control-plane/projects';
const DEFAULT_SWARMS_DIR = 'control-plane/swarms';

export type RuntimeValidationStatus = 'ok' | 'failed';

export type RuntimeExecutionResult = {
  swarmId: string;
  phase: OrchestrationPhase;
  executionStatus: 'success' | 'skipped';
};

export type RuntimeOrchestrationReport = {
  orchestrationVersion: 1;
  validationStatus: RuntimeValidationStatus;
  validationViolations: string[];
  cycleDetected?: string[];
  executionAttempted: boolean;
  executionOrder: string[];
  executionResults: RuntimeExecutionResult[];
};

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function toValidationFailureReport(violations: string[], cycleDetected?: string[]): RuntimeOrchestrationReport {
  return {
    orchestrationVersion: 1,
    validationStatus: 'failed',
    validationViolations: sortedUnique(violations),
    ...(cycleDetected && cycleDetected.length > 0 ? { cycleDetected: [...cycleDetected] } : {}),
    executionAttempted: false,
    executionOrder: [],
    executionResults: []
  };
}

function toValidationSuccessReport(executionOrder: string[], phaseBySwarm: Record<string, string>): RuntimeOrchestrationReport {
  const executionResults: RuntimeExecutionResult[] = executionOrder.map((swarmId) => {
    const phase = phaseBySwarm[swarmId] as OrchestrationPhase | undefined;
    if (!phase) {
      throw new Error(`runtime.orchestration_missing_phase: swarmId=${swarmId}`);
    }

    return {
      swarmId,
      phase,
      executionStatus: 'success'
    };
  });

  return {
    orchestrationVersion: 1,
    validationStatus: 'ok',
    validationViolations: [],
    executionAttempted: true,
    executionOrder: [...executionOrder],
    executionResults
  };
}

export function runRuntimeOrchestrator(params: {
  swarms: SwarmDefinition[];
  registryPath?: string;
}): RuntimeOrchestrationReport {
  const registryPath = params.registryPath ?? DEFAULT_REGISTRY_PATH;
  const registryResult = loadOrchestrationRegistryFromFile(registryPath);

  if (registryResult.status === 'missing_registry' || registryResult.status === 'invalid_registry') {
    return toValidationFailureReport(registryResult.errors);
  }

  const validationResult = evaluateSwarmOrchestrationContracts({
    swarms: params.swarms,
    registry: registryResult.registry
  });

  if (validationResult.status !== 'ok') {
    return toValidationFailureReport(validationResult.violations, validationResult.cycleDetected);
  }

  return toValidationSuccessReport(validationResult.topologicalOrder, validationResult.phaseBySwarm);
}

export function runRuntimeOrchestratorFromRepo(params: {
  projectsDir?: string;
  swarmsDir?: string;
  registryPath?: string;
} = {}): RuntimeOrchestrationReport {
  const projectsDir = params.projectsDir ?? DEFAULT_PROJECTS_DIR;
  const swarmsDir = params.swarmsDir ?? DEFAULT_SWARMS_DIR;
  const projects = loadProjectsFromDir(projectsDir);
  const swarms = loadSwarmsFromDir(swarmsDir, projects);

  return runRuntimeOrchestrator({
    swarms,
    registryPath: params.registryPath
  });
}

type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike };

function normalizeJsonValue(value: unknown): JsonLike | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeJsonValue(entry))
      .filter((entry): entry is JsonLike => entry !== undefined);
  }
  if (typeof value === 'object') {
    const sortedEntries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));

    const normalized: { [key: string]: JsonLike } = {};
    for (const [key, entryValue] of sortedEntries) {
      const entry = normalizeJsonValue(entryValue);
      if (entry !== undefined) {
        normalized[key] = entry;
      }
    }
    return normalized;
  }
  return JSON.parse(JSON.stringify(value)) as JsonLike;
}

export function stableStringify(value: unknown): string {
  const normalized = normalizeJsonValue(value);
  return JSON.stringify(normalized ?? null);
}
