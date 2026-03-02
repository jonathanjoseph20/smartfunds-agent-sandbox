import type { DatabaseSync } from 'node:sqlite';

import { canonicalStringify } from '../../finance/determinism.ts';
import type { BillingProfile } from '../models/billingProfile.ts';
import type { RailBinding } from '../models/railBinding.ts';
import {
  createBillingProfile,
  createRailBinding,
  findActiveBillingProfileByLabel,
  getBillingProfileById,
  getProjectById,
  getRailBindingById,
  listBillingProfilesByProjectId,
  listRailBindingsByBillingProfileId,
  nextCounterId,
  updateBillingProfile,
  updateRailBinding,
  withTransaction
} from '../storage/index.ts';
import { CockpitError, requireBillingProfile, requireProject } from './invariants.ts';
import { resolveIdempotentResource, saveIdempotencyResource } from './idempotency.ts';

export function createProjectBillingProfile(
  db: DatabaseSync,
  projectId: string,
  input: { label: string; status: 'active' | 'disabled'; idempotencyKey: string | null }
): BillingProfile {
  return withTransaction(db, () => {
    const project = requireProject(db, projectId);

    const scope = `create-billing-profile:${projectId}`;
    const existingReference = resolveIdempotentResource(db, scope, input.idempotencyKey);
    if (existingReference?.resourceType === 'billing_profile') {
      const existing = getBillingProfileById(db, existingReference.resourceId);
      if (existing) {
        return existing;
      }
    }

    const existingLabel = findActiveBillingProfileByLabel(db, projectId, input.label);
    if (existingLabel) {
      throw new CockpitError(409, `active billing profile label already exists: ${input.label}`);
    }

    const billingProfileId = nextCounterId(db, 'billing-profile');
    const profile: BillingProfile = {
      billingProfileId,
      entityId: project.entityId,
      projectId,
      label: input.label,
      status: input.status,
      archivedAt: null
    };
    createBillingProfile(db, profile);

    saveIdempotencyResource(db, scope, input.idempotencyKey, 'billing_profile', billingProfileId);
    return profile;
  });
}

export function patchBillingProfile(
  db: DatabaseSync,
  billingProfileId: string,
  input: { status: 'active' | 'disabled' | null; archived: boolean | null }
): BillingProfile {
  return withTransaction(db, () => {
    const current = requireBillingProfile(db, billingProfileId);

    const nextArchivedAt = input.archived === null ? current.archivedAt : (input.archived ? 'ARCHIVED' : null);
    if (nextArchivedAt === null) {
      const existing = findActiveBillingProfileByLabel(db, current.projectId, current.label);
      if (existing && existing.billingProfileId !== current.billingProfileId) {
        throw new CockpitError(409, `active billing profile label already exists: ${current.label}`);
      }
    }

    const updated: BillingProfile = {
      ...current,
      status: input.status ?? current.status,
      archivedAt: nextArchivedAt
    };

    updateBillingProfile(db, updated);
    return updated;
  });
}

export function listProjectBillingProfiles(db: DatabaseSync, projectId: string, includeArchived: boolean): BillingProfile[] {
  if (!getProjectById(db, projectId)) {
    throw new CockpitError(404, 'project not found');
  }
  return listBillingProfilesByProjectId(db, projectId, includeArchived);
}

export function createBillingRailBinding(
  db: DatabaseSync,
  billingProfileId: string,
  input: { railType: string; status: 'active' | 'disabled'; externalRef: string | null; metadata: Record<string, unknown> | null }
): RailBinding {
  return withTransaction(db, () => {
    requireBillingProfile(db, billingProfileId);

    const railBindingId = nextCounterId(db, 'rail-binding');
    const railBinding: RailBinding = {
      railBindingId,
      billingProfileId,
      railType: input.railType,
      status: input.status,
      externalRef: input.externalRef,
      metadataJson: input.metadata ? canonicalStringify(input.metadata) : null
    };

    createRailBinding(db, railBinding);
    return railBinding;
  });
}

export function listBillingRailBindings(db: DatabaseSync, billingProfileId: string): RailBinding[] {
  requireBillingProfile(db, billingProfileId);
  return listRailBindingsByBillingProfileId(db, billingProfileId);
}

export function patchRailBinding(
  db: DatabaseSync,
  railBindingId: string,
  input: { status: 'active' | 'disabled' | null; externalRef: string | null | undefined; metadata: Record<string, unknown> | null | undefined }
): RailBinding {
  const current = getRailBindingById(db, railBindingId);
  if (!current) {
    throw new CockpitError(404, 'rail binding not found');
  }

  const updated: RailBinding = {
    ...current,
    status: input.status ?? current.status,
    externalRef: input.externalRef === undefined ? current.externalRef : input.externalRef,
    metadataJson: input.metadata === undefined ? current.metadataJson : (input.metadata ? canonicalStringify(input.metadata) : null)
  };

  updateRailBinding(db, updated);
  return updated;
}
