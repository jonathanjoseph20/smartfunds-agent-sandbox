import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import { deriveEngineeringPlanId } from './engineering-plan-identity.ts';
import {
  appendEngineeringPlanEvent as appendEngineeringPlanEventToDefaultStore,
  createEngineeringPlanHistoryStore,
  type EngineeringPlanHistoryStore,
} from './engineering-plan-history-store.ts';
import { projectEngineeringPlan } from './engineering-plan-projection.ts';
import {
  deriveEngineeringPlanStatus as deriveEngineeringPlanStatusDefinition,
  EngineeringPlanStatus,
} from './engineering-plan-status.ts';
import type {
  EngineeringPlan,
  EngineeringPlanHistoryEvent,
  EngineeringPlanProjection,
  EngineeringPlanValidation,
} from './engineering-plan-types.ts';
import { validateEngineeringPlan as validateEngineeringPlanDefinition } from './engineering-plan-validation.ts';

const DEFAULT_ENGINEERING_PLANS_FILE = path.join('runtime-data', 'engineering', 'engineering-plans.json');

type EngineeringPlanDraftInput = {
  specId: string;
  architectureSummary: string;
  subsystems: string[];
  implementationPhases: string[];
  dependencies?: string[];
  integrationRequirements?: string[];
  testStrategy: string;
  constraints?: string[];
};

type EngineeringPlanStore = {
  plans: EngineeringPlan[];
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

function parseStatus(value: unknown): EngineeringPlanStatus | null {
  if (value === EngineeringPlanStatus.INCOMPLETE
    || value === EngineeringPlanStatus.DRAFT
    || value === EngineeringPlanStatus.VALIDATED
    || value === EngineeringPlanStatus.BLOCKED
    || value === EngineeringPlanStatus.COMPLETE) {
    return value;
  }

  return null;
}

function parsePlan(value: unknown): EngineeringPlan {
  if (!isRecord(value)) {
    throw new Error('ENGINEERING_PLAN_INVALID_PLAN');
  }

  const planId = asString(value.planId);
  const specId = asString(value.specId);
  const architectureSummary = normalizeString(value.architectureSummary);
  const testStrategy = normalizeString(value.testStrategy);
  const status = parseStatus(value.status);
  const subsystems = normalizeStringArray(value.subsystems);
  const implementationPhases = normalizeStringArray(value.implementationPhases);

  if (!planId || !specId || !status) {
    throw new Error('ENGINEERING_PLAN_INVALID_PLAN');
  }

  const dependencies = normalizeStringArray(value.dependencies);
  const integrationRequirements = normalizeStringArray(value.integrationRequirements);
  const constraints = normalizeStringArray(value.constraints);

  return {
    planId,
    specId,
    architectureSummary,
    subsystems,
    implementationPhases,
    dependencies,
    integrationRequirements,
    testStrategy,
    constraints,
    status,
  };
}

function readStore(filePath: string): EngineeringPlanStore {
  if (!fs.existsSync(filePath)) {
    return { plans: [] };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('ENGINEERING_PLAN_INVALID_STORE');
  }

  const plans = Array.isArray(parsed.plans)
    ? parsed.plans.map((entry) => parsePlan(entry)).sort((left, right) => left.planId.localeCompare(right.planId))
    : [];

  return { plans };
}

function writeStore(filePath: string, store: EngineeringPlanStore): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const normalizedStore: EngineeringPlanStore = {
    plans: [...store.plans].sort((left, right) => left.planId.localeCompare(right.planId)),
  };
  fs.writeFileSync(filePath, `${canonicalStringify(normalizedStore)}\n`, 'utf8');
}

function normalizeDraftInput(input: Partial<EngineeringPlanDraftInput>): EngineeringPlanDraftInput {
  const dependencies = normalizeStringArray(input.dependencies);
  const integrationRequirements = normalizeStringArray(input.integrationRequirements);
  const constraints = normalizeStringArray(input.constraints);

  return {
    specId: normalizeString(input.specId),
    architectureSummary: normalizeString(input.architectureSummary),
    subsystems: normalizeStringArray(input.subsystems),
    implementationPhases: normalizeStringArray(input.implementationPhases),
    ...(dependencies.length > 0 ? { dependencies } : {}),
    ...(integrationRequirements.length > 0 ? { integrationRequirements } : {}),
    testStrategy: normalizeString(input.testStrategy),
    ...(constraints.length > 0 ? { constraints } : {}),
  };
}

function toPayloadHash(value: unknown): string {
  return sha256(canonicalStringify(value));
}

function toValidation(plan: EngineeringPlan): EngineeringPlanValidation {
  return validateEngineeringPlanDefinition(plan);
}

export function createEngineeringPlanManager(options: {
  plansFilePath?: string;
  historyStore?: EngineeringPlanHistoryStore;
  historyFilePath?: string;
} = {}) {
  const plansFilePath = options.plansFilePath ?? DEFAULT_ENGINEERING_PLANS_FILE;
  const historyStore = options.historyStore ?? createEngineeringPlanHistoryStore({ historyFilePath: options.historyFilePath });

  function getEngineeringPlan(planId: string): EngineeringPlan {
    const store = readStore(plansFilePath);
    const plan = store.plans.find((entry) => entry.planId === planId);
    if (!plan) {
      throw new Error(`ENGINEERING_PLAN_NOT_FOUND: ${planId}`);
    }
    return plan;
  }

  function listEngineeringPlans(): EngineeringPlan[] {
    return readStore(plansFilePath).plans;
  }

  function createEngineeringPlan(payload: Partial<EngineeringPlanDraftInput>): {
    planId: string;
    status: EngineeringPlanStatus;
    plan: EngineeringPlan;
    validation: EngineeringPlanValidation;
  } {
    const normalizedPayload = normalizeDraftInput(payload);
    const planId = deriveEngineeringPlanId(normalizedPayload);

    const store = readStore(plansFilePath);
    const existing = store.plans.find((entry) => entry.planId === planId);
    if (existing) {
      return {
        planId,
        status: existing.status,
        plan: existing,
        validation: toValidation(existing),
      };
    }

    const validation = validateEngineeringPlanDefinition(normalizedPayload);
    const status = deriveEngineeringPlanStatusDefinition(validation, { promotedToValidated: false });

    const plan: EngineeringPlan = {
      planId,
      specId: normalizedPayload.specId,
      architectureSummary: normalizedPayload.architectureSummary,
      subsystems: normalizedPayload.subsystems,
      implementationPhases: normalizedPayload.implementationPhases,
      dependencies: normalizedPayload.dependencies ?? [],
      integrationRequirements: normalizedPayload.integrationRequirements ?? [],
      testStrategy: normalizedPayload.testStrategy,
      constraints: normalizedPayload.constraints ?? [],
      status,
    };

    writeStore(plansFilePath, {
      plans: [...store.plans, plan],
    });

    historyStore.appendEngineeringPlanEvent({
      eventType: 'engineering_plan_created',
      planId,
      payloadHash: toPayloadHash(plan),
    });

    return {
      planId,
      status,
      plan,
      validation,
    };
  }

  function validateEngineeringPlan(planId: string): {
    plan: EngineeringPlan;
    validation: EngineeringPlanValidation;
    status: EngineeringPlanStatus;
    historyEvents: EngineeringPlanHistoryEvent[];
    projection: EngineeringPlanProjection;
  } {
    const store = readStore(plansFilePath);
    const index = store.plans.findIndex((entry) => entry.planId === planId);
    if (index < 0) {
      throw new Error(`ENGINEERING_PLAN_NOT_FOUND: ${planId}`);
    }

    const current = store.plans[index]!;
    const validation = toValidation(current);
    const nextStatus = deriveEngineeringPlanStatusDefinition(validation, {
      promotedToValidated: validation.validationState === 'valid'
        && validation.missingFields.length === 0
        && validation.constraintViolations.length === 0,
    });

    historyStore.appendEngineeringPlanEvent({
      eventType: 'engineering_plan_validated',
      planId,
      payloadHash: toPayloadHash(validation),
    });

    let nextPlan = current;

    if (current.status !== nextStatus) {
      nextPlan = {
        ...current,
        status: nextStatus,
      };

      const updatedPlans = [...store.plans];
      updatedPlans[index] = nextPlan;
      writeStore(plansFilePath, { plans: updatedPlans });

      historyStore.appendEngineeringPlanEvent({
        eventType: 'engineering_plan_status_changed',
        planId,
        payloadHash: toPayloadHash({ previousStatus: current.status, nextStatus }),
      });
    }

    const historyEvents = historyStore.listEngineeringPlanEvents(planId);
    const projection = projectEngineeringPlan({
      plan: nextPlan,
      validation,
      historyEvents,
    });

    return {
      plan: nextPlan,
      validation,
      status: nextPlan.status,
      historyEvents,
      projection,
    };
  }

  function deriveEngineeringPlanStatus(
    planId: string,
    options: { promotedToValidated?: boolean } = {},
  ): EngineeringPlanStatus {
    const plan = getEngineeringPlan(planId);
    const validation = validateEngineeringPlanDefinition(plan);
    return deriveEngineeringPlanStatusDefinition(validation, options);
  }

  function appendEngineeringPlanEvent(event: EngineeringPlanHistoryEvent) {
    return historyStore.appendEngineeringPlanEvent(event);
  }

  function deriveEngineeringPlanProjection(planId: string): EngineeringPlanProjection {
    const plan = getEngineeringPlan(planId);
    const validation = toValidation(plan);
    const historyEvents = historyStore.listEngineeringPlanEvents(planId);
    return projectEngineeringPlan({
      plan,
      validation,
      historyEvents,
    });
  }

  function listEngineeringPlanProjections(): EngineeringPlanProjection[] {
    return listEngineeringPlans()
      .map((plan) => deriveEngineeringPlanProjection(plan.planId))
      .sort((left, right) => left.planId.localeCompare(right.planId));
  }

  return {
    createEngineeringPlan,
    validateEngineeringPlan,
    deriveEngineeringPlanStatus,
    appendEngineeringPlanEvent,
    deriveEngineeringPlanProjection,
    listEngineeringPlanProjections,
    listEngineeringPlans,
    getEngineeringPlan,
    historyStore,
  };
}

const defaultManager = createEngineeringPlanManager();

export function createEngineeringPlan(payload: Partial<EngineeringPlanDraftInput>) {
  return defaultManager.createEngineeringPlan(payload);
}

export function validateEngineeringPlan(planId: string) {
  return defaultManager.validateEngineeringPlan(planId);
}

export function deriveEngineeringPlanProjection(planId: string): EngineeringPlanProjection {
  return defaultManager.deriveEngineeringPlanProjection(planId);
}

export function appendEngineeringPlanEvent(event: EngineeringPlanHistoryEvent) {
  return appendEngineeringPlanEventToDefaultStore(event);
}
