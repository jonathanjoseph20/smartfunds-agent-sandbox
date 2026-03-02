import { parseCreateBillingProfileInput, parsePatchBillingProfileInput } from '../models/billingProfile.ts';
import { parseCreateRailBindingInput, parsePatchRailBindingInput } from '../models/railBinding.ts';
import { getBillingProfileById } from '../storage/index.ts';
import { CockpitError } from '../service/invariants.ts';
import {
  createBillingRailBinding,
  createProjectBillingProfile,
  listBillingRailBindings,
  listProjectBillingProfiles,
  patchBillingProfile,
  patchRailBinding
} from '../service/billing.ts';
import type { CockpitApiContext, CockpitApiRequest, CockpitApiResponse } from './_common.ts';
import { jsonOrNull, parseBody, parseIncludeArchived, response, withErrorHandling } from './_common.ts';

export function handleBillingRoutes(request: CockpitApiRequest, ctx: CockpitApiContext): CockpitApiResponse | null {
  return withErrorHandling(() => {
    if (request.method === 'POST' && request.pathname.startsWith('/projects/') && request.pathname.endsWith('/billing-profiles')) {
      const projectId = request.pathname.slice('/projects/'.length, -'/billing-profiles'.length);
      const input = parseCreateBillingProfileInput(parseBody(request.bodyText));
      const profile = createProjectBillingProfile(ctx.db, projectId, input);
      return response(201, profile);
    }

    if (request.method === 'GET' && request.pathname.startsWith('/projects/') && request.pathname.endsWith('/billing-profiles')) {
      const projectId = request.pathname.slice('/projects/'.length, -'/billing-profiles'.length);
      return response(200, listProjectBillingProfiles(ctx.db, projectId, parseIncludeArchived(request.query)));
    }

    if (request.method === 'PATCH' && request.pathname.startsWith('/billing-profiles/')) {
      const billingProfileId = request.pathname.slice('/billing-profiles/'.length).trim();
      const current = getBillingProfileById(ctx.db, billingProfileId);
      if (!current) {
        throw new CockpitError(404, 'billing profile not found');
      }
      const body = parseBody(request.bodyText) as Record<string, unknown>;
      if (body.projectId !== undefined && body.projectId !== current.projectId) {
        throw new CockpitError(409, 'projectId is immutable');
      }
      if (body.entityId !== undefined && body.entityId !== current.entityId) {
        throw new CockpitError(409, 'entityId is immutable');
      }
      const input = parsePatchBillingProfileInput(body);
      return response(200, patchBillingProfile(ctx.db, billingProfileId, input));
    }

    if (request.method === 'POST' && request.pathname.startsWith('/billing-profiles/') && request.pathname.endsWith('/rail-bindings')) {
      const billingProfileId = request.pathname.slice('/billing-profiles/'.length, -'/rail-bindings'.length);
      const input = parseCreateRailBindingInput(parseBody(request.bodyText));
      const binding = createBillingRailBinding(ctx.db, billingProfileId, input);
      return response(201, {
        ...binding,
        metadataJson: jsonOrNull(binding.metadataJson)
      });
    }

    if (request.method === 'GET' && request.pathname.startsWith('/billing-profiles/') && request.pathname.endsWith('/rail-bindings')) {
      const billingProfileId = request.pathname.slice('/billing-profiles/'.length, -'/rail-bindings'.length);
      return response(200, listBillingRailBindings(ctx.db, billingProfileId).map((binding) => ({
        ...binding,
        metadataJson: jsonOrNull(binding.metadataJson)
      })));
    }

    if (request.method === 'PATCH' && request.pathname.startsWith('/rail-bindings/')) {
      const railBindingId = request.pathname.slice('/rail-bindings/'.length).trim();
      const input = parsePatchRailBindingInput(parseBody(request.bodyText));
      const binding = patchRailBinding(ctx.db, railBindingId, input);
      return response(200, {
        ...binding,
        metadataJson: jsonOrNull(binding.metadataJson)
      });
    }

    return null;
  });
}
