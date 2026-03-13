import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import { deriveProductSpecId } from './product-spec-identity.ts';
import { createProductSpecHistoryStore, type ProductSpecHistoryStore } from './product-spec-history-store.ts';
import { projectProductSpec } from './product-spec-projection.ts';
import { deriveProductSpecStatus } from './product-spec-status.ts';
import type {
  ProductSpec,
  ProductSpecHistoryEvent,
  ProductSpecProjection,
  ProductSpecValidation,
} from './product-spec-types.ts';
import { validateProductSpec as validateProductSpecDefinition } from './product-spec-validation.ts';

const DEFAULT_PRODUCT_SPECS_FILE = path.join('runtime-data', 'products', 'product-specs.json');

type ProductSpecDraftInput = {
  name: string;
  problem: string;
  targetUser: string;
  solution: string;
  architectureSummary?: string;
  mvpScope: string;
  constraints?: string[];
  dependencies?: string[];
  originMissionIds: string[];
};

type ProductSpecStore = {
  specs: ProductSpec[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .sort((left, right) => left.localeCompare(right));
}

function parseSpec(value: unknown): ProductSpec {
  if (!isRecord(value)) {
    throw new Error('PRODUCT_SPEC_INVALID_SPEC');
  }

  const specId = asString(value.specId);
  const name = asString(value.name);
  const problem = asString(value.problem);
  const targetUser = asString(value.targetUser);
  const solution = asString(value.solution);
  const mvpScope = asString(value.mvpScope);
  const status = asString(value.status) as ProductSpec['status'];
  const originMissionIds = normalizeStringArray(value.originMissionIds);

  if (!specId || !name || !problem || !targetUser || !solution || !mvpScope || !status || originMissionIds.length === 0) {
    throw new Error('PRODUCT_SPEC_INVALID_SPEC');
  }

  const architectureSummary = normalizeString(value.architectureSummary);
  const constraints = normalizeStringArray(value.constraints);
  const dependencies = normalizeStringArray(value.dependencies);

  return {
    specId,
    name,
    problem,
    targetUser,
    solution,
    ...(architectureSummary.length > 0 ? { architectureSummary } : {}),
    mvpScope,
    ...(constraints.length > 0 ? { constraints } : {}),
    ...(dependencies.length > 0 ? { dependencies } : {}),
    originMissionIds,
    status,
  };
}

function readStore(filePath: string): ProductSpecStore {
  if (!fs.existsSync(filePath)) {
    return { specs: [] };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('PRODUCT_SPEC_INVALID_STORE');
  }

  const specs = Array.isArray(parsed.specs)
    ? parsed.specs.map((entry) => parseSpec(entry)).sort((left, right) => left.specId.localeCompare(right.specId))
    : [];

  return { specs };
}

function writeStore(filePath: string, store: ProductSpecStore): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const normalizedStore: ProductSpecStore = {
    specs: [...store.specs].sort((left, right) => left.specId.localeCompare(right.specId)),
  };
  fs.writeFileSync(filePath, `${canonicalStringify(normalizedStore)}\n`, 'utf8');
}

function normalizeDraftInput(input: Partial<ProductSpecDraftInput>): ProductSpecDraftInput {
  const architectureSummary = normalizeString(input.architectureSummary);
  const constraints = normalizeStringArray(input.constraints);
  const dependencies = normalizeStringArray(input.dependencies);

  return {
    name: normalizeString(input.name),
    problem: normalizeString(input.problem),
    targetUser: normalizeString(input.targetUser),
    solution: normalizeString(input.solution),
    ...(architectureSummary.length > 0 ? { architectureSummary } : {}),
    mvpScope: normalizeString(input.mvpScope),
    ...(constraints.length > 0 ? { constraints } : {}),
    ...(dependencies.length > 0 ? { dependencies } : {}),
    originMissionIds: normalizeStringArray(input.originMissionIds),
  };
}

function toPayloadHash(value: unknown): string {
  return sha256(canonicalStringify(value));
}

function toValidation(spec: ProductSpec): ProductSpecValidation {
  return validateProductSpecDefinition(spec);
}

export function createProductSpecManager(options: {
  specsFilePath?: string;
  historyStore?: ProductSpecHistoryStore;
  historyFilePath?: string;
} = {}) {
  const specsFilePath = options.specsFilePath ?? DEFAULT_PRODUCT_SPECS_FILE;
  const historyStore = options.historyStore ?? createProductSpecHistoryStore({ historyFilePath: options.historyFilePath });

  function getProductSpec(specId: string): ProductSpec {
    const store = readStore(specsFilePath);
    const spec = store.specs.find((entry) => entry.specId === specId);
    if (!spec) {
      throw new Error(`PRODUCT_SPEC_NOT_FOUND: ${specId}`);
    }
    return spec;
  }

  function listProductSpecs(): ProductSpec[] {
    return readStore(specsFilePath).specs;
  }

  function createProductSpec(payload: Partial<ProductSpecDraftInput>): {
    specId: string;
    status: ProductSpec['status'];
    spec: ProductSpec;
    validation: ProductSpecValidation;
  } {
    const normalizedPayload = normalizeDraftInput(payload);
    const specId = deriveProductSpecId(normalizedPayload);

    const store = readStore(specsFilePath);
    const existing = store.specs.find((entry) => entry.specId === specId);
    if (existing) {
      return {
        specId,
        status: existing.status,
        spec: existing,
        validation: toValidation(existing),
      };
    }

    const validation = validateProductSpecDefinition(normalizedPayload);
    const status = deriveProductSpecStatus(validation, { promotedToValidated: false });

    const spec: ProductSpec = {
      specId,
      name: normalizedPayload.name,
      problem: normalizedPayload.problem,
      targetUser: normalizedPayload.targetUser,
      solution: normalizedPayload.solution,
      ...(normalizedPayload.architectureSummary ? { architectureSummary: normalizedPayload.architectureSummary } : {}),
      mvpScope: normalizedPayload.mvpScope,
      ...(normalizedPayload.constraints ? { constraints: normalizedPayload.constraints } : {}),
      ...(normalizedPayload.dependencies ? { dependencies: normalizedPayload.dependencies } : {}),
      originMissionIds: normalizedPayload.originMissionIds,
      status,
    };

    writeStore(specsFilePath, {
      specs: [...store.specs, spec],
    });

    historyStore.appendProductSpecEvent({
      eventType: 'product_spec_created',
      specId,
      payloadHash: toPayloadHash(spec),
    });

    return {
      specId,
      status,
      spec,
      validation,
    };
  }

  function validateProductSpec(specId: string): {
    spec: ProductSpec;
    validation: ProductSpecValidation;
    status: ProductSpec['status'];
    historyEvents: ProductSpecHistoryEvent[];
    projection: ProductSpecProjection;
  } {
    const store = readStore(specsFilePath);
    const index = store.specs.findIndex((entry) => entry.specId === specId);
    if (index < 0) {
      throw new Error(`PRODUCT_SPEC_NOT_FOUND: ${specId}`);
    }

    const current = store.specs[index]!;
    const validation = toValidation(current);
    const nextStatus = deriveProductSpecStatus(validation, {
      promotedToValidated: validation.validationState === 'valid'
        && validation.missingFields.length === 0
        && validation.constraintViolations.length === 0,
    });

    historyStore.appendProductSpecEvent({
      eventType: 'product_spec_validated',
      specId,
      payloadHash: toPayloadHash(validation),
    });

    let nextSpec = current;

    if (current.status !== nextStatus) {
      nextSpec = {
        ...current,
        status: nextStatus,
      };

      const updatedSpecs = [...store.specs];
      updatedSpecs[index] = nextSpec;
      writeStore(specsFilePath, { specs: updatedSpecs });

      historyStore.appendProductSpecEvent({
        eventType: 'product_spec_status_changed',
        specId,
        payloadHash: toPayloadHash({ previousStatus: current.status, nextStatus }),
      });
    }

    const historyEvents = historyStore.listProductSpecEvents(specId);
    const projection = projectProductSpec({
      spec: nextSpec,
      validation,
      historyEvents,
    });

    return {
      spec: nextSpec,
      validation,
      status: nextSpec.status,
      historyEvents,
      projection,
    };
  }

  function deriveProductSpecProjection(specId: string): ProductSpecProjection {
    const spec = getProductSpec(specId);
    const validation = toValidation(spec);
    const historyEvents = historyStore.listProductSpecEvents(specId);
    return projectProductSpec({
      spec,
      validation,
      historyEvents,
    });
  }

  function listProductSpecProjections(): ProductSpecProjection[] {
    return listProductSpecs()
      .map((spec) => deriveProductSpecProjection(spec.specId))
      .sort((left, right) => left.specId.localeCompare(right.specId));
  }

  return {
    createProductSpec,
    validateProductSpec,
    deriveProductSpecProjection,
    listProductSpecProjections,
    listProductSpecs,
    getProductSpec,
    historyStore,
  };
}

const defaultManager = createProductSpecManager();

export function createProductSpec(payload: Partial<ProductSpecDraftInput>) {
  return defaultManager.createProductSpec(payload);
}

export function validateProductSpec(specId: string) {
  return defaultManager.validateProductSpec(specId);
}

export function deriveProductSpecProjection(specId: string): ProductSpecProjection {
  return defaultManager.deriveProductSpecProjection(specId);
}
