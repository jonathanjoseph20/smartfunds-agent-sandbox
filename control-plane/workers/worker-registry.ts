import fs from 'node:fs';
import path from 'node:path';

import type { WorkerCapability, WorkerDefinition, WorkerStatus } from './worker-types.ts';
import { WORKER_STATUSES } from './worker-types.ts';

export const DEFAULT_WORKER_DEFINITIONS_DIR = 'control-plane/workers/definitions';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asUniqueStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = value
    .map((entry) => asTrimmedString(entry))
    .filter((entry): entry is string => entry !== null);

  if (normalized.length !== value.length) {
    return null;
  }

  return Array.from(new Set(normalized)).sort((left, right) => left.localeCompare(right));
}

function asWorkerStatus(value: unknown): WorkerStatus | null {
  if (typeof value !== 'string') {
    return null;
  }

  return WORKER_STATUSES.includes(value as WorkerStatus)
    ? value as WorkerStatus
    : null;
}

function validateWorkerDefinition(value: unknown, sourceLabel = '<inline>'): WorkerDefinition {
  if (!isRecord(value)) {
    throw new Error(`WORKER_INVALID_DEFINITION: ${sourceLabel} must be an object.`);
  }

  const workerId = asTrimmedString(value.workerId);
  const workerType = asTrimmedString(value.workerType);
  const supportedTaskTypes = asUniqueStringArray(value.supportedTaskTypes);
  const capabilities = asUniqueStringArray(value.capabilities);
  const version = value.version === undefined ? undefined : asTrimmedString(value.version);
  const status = asWorkerStatus(value.status);

  if (!workerId) {
    throw new Error(`WORKER_INVALID_DEFINITION: ${sourceLabel} workerId must be a non-empty string.`);
  }

  if (!workerType) {
    throw new Error(`WORKER_INVALID_DEFINITION: ${sourceLabel} workerType must be a non-empty string.`);
  }

  if (!supportedTaskTypes) {
    throw new Error(`WORKER_INVALID_DEFINITION: ${sourceLabel} supportedTaskTypes must be an array of non-empty strings.`);
  }

  if (!capabilities) {
    throw new Error(`WORKER_INVALID_DEFINITION: ${sourceLabel} capabilities must be an array of non-empty strings.`);
  }

  if (value.version !== undefined && !version) {
    throw new Error(`WORKER_INVALID_DEFINITION: ${sourceLabel} version must be a non-empty string when provided.`);
  }

  if (!status) {
    throw new Error(`WORKER_INVALID_DEFINITION: ${sourceLabel} status must be one of ${WORKER_STATUSES.join(', ')}.`);
  }

  return {
    workerId,
    workerType,
    supportedTaskTypes,
    capabilities: capabilities as WorkerCapability[],
    ...(version ? { version } : {}),
    status,
  };
}

function loadWorkerDefinitions(options: { definitionsDir?: string } = {}): WorkerDefinition[] {
  const definitionsDir = path.resolve(options.definitionsDir ?? DEFAULT_WORKER_DEFINITIONS_DIR);
  if (!fs.existsSync(definitionsDir)) {
    throw new Error(`WORKER_DEFINITIONS_NOT_FOUND: ${definitionsDir}`);
  }

  const files = fs.readdirSync(definitionsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  return files
    .map((entry) => {
      const filePath = path.join(definitionsDir, entry);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
      return validateWorkerDefinition(parsed, entry);
    })
    .sort((left, right) => left.workerId.localeCompare(right.workerId));
}

function createWorkerRegistry(options: { definitionsDir?: string } = {}) {
  const byId = new Map<string, WorkerDefinition>();
  const definitions = loadWorkerDefinitions(options);

  for (const definition of definitions) {
    if (byId.has(definition.workerId)) {
      throw new Error(`WORKER_DUPLICATE_DEFINITION: ${definition.workerId}`);
    }
    byId.set(definition.workerId, definition);
  }

  function registerWorker(worker: WorkerDefinition): WorkerDefinition {
    const normalized = validateWorkerDefinition(worker, 'registerWorker');
    if (byId.has(normalized.workerId)) {
      throw new Error(`WORKER_DUPLICATE_DEFINITION: ${normalized.workerId}`);
    }
    byId.set(normalized.workerId, normalized);
    return normalized;
  }

  function getWorker(workerId: string): WorkerDefinition {
    const found = byId.get(workerId);
    if (!found) {
      throw new Error(`WORKER_NOT_FOUND: ${workerId}`);
    }

    return found;
  }

  function listWorkers(): WorkerDefinition[] {
    return [...byId.values()].sort((left, right) => left.workerId.localeCompare(right.workerId));
  }

  function validateWorkerSupportsTask(workerId: string, taskType: string): boolean {
    const worker = getWorker(workerId);
    return worker.status === 'active' && worker.supportedTaskTypes.includes(taskType);
  }

  function validateWorkerCapabilities(workerId: string, requiredCapabilities: string[]): boolean {
    const worker = getWorker(workerId);
    if (worker.status !== 'active') {
      return false;
    }

    const required = Array.from(new Set(requiredCapabilities)).sort((left, right) => left.localeCompare(right));
    return required.every((capability) => worker.capabilities.includes(capability));
  }

  return {
    registerWorker,
    getWorker,
    listWorkers,
    validateWorkerSupportsTask,
    validateWorkerCapabilities,
  };
}

export function loadWorkerRegistry(options: { definitionsDir?: string } = {}) {
  return createWorkerRegistry(options);
}

export function getWorker(workerId: string, options: { definitionsDir?: string } = {}): WorkerDefinition {
  return createWorkerRegistry(options).getWorker(workerId);
}

export function listWorkers(options: { definitionsDir?: string } = {}): WorkerDefinition[] {
  return createWorkerRegistry(options).listWorkers();
}

export function validateWorkerSupportsTask(workerId: string, taskType: string, options: { definitionsDir?: string } = {}): boolean {
  return createWorkerRegistry(options).validateWorkerSupportsTask(workerId, taskType);
}

export function validateWorkerCapabilities(workerId: string, requiredCapabilities: string[], options: { definitionsDir?: string } = {}): boolean {
  return createWorkerRegistry(options).validateWorkerCapabilities(workerId, requiredCapabilities);
}

export type WorkerRegistry = ReturnType<typeof createWorkerRegistry>;
