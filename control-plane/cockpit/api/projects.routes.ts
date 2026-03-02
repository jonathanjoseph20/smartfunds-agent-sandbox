import { parseCreateProjectInput, parsePatchProjectInput } from '../models/project.ts';
import {
  createProject,
  getBillingProfileById,
  getEntityById,
  getProjectById,
  listProjects,
  nextCounterId,
  updateProject,
  withTransaction
} from '../storage/index.ts';
import { resolveIdempotentResource, saveIdempotencyResource } from '../service/idempotency.ts';
import { CockpitError } from '../service/invariants.ts';
import type { CockpitApiContext, CockpitApiRequest, CockpitApiResponse } from './_common.ts';
import { parseBody, parseIncludeArchived, response, withErrorHandling } from './_common.ts';

export function handleProjectsRoutes(request: CockpitApiRequest, ctx: CockpitApiContext): CockpitApiResponse | null {
  return withErrorHandling(() => {
    if (request.method === 'POST' && request.pathname === '/projects') {
      const input = parseCreateProjectInput(parseBody(request.bodyText));
      const result = withTransaction(ctx.db, () => {
        const entity = getEntityById(ctx.db, input.entityId);
        if (!entity) {
          throw new CockpitError(404, 'entity not found');
        }

        const scope = 'create-project';
        const existingReference = resolveIdempotentResource(ctx.db, scope, input.idempotencyKey);
        if (existingReference?.resourceType === 'project') {
          const existing = getProjectById(ctx.db, existingReference.resourceId);
          if (existing) {
            return { resource: existing, created: false };
          }
        }

        const project = createProject(ctx.db, {
          projectId: nextCounterId(ctx.db, 'project'),
          entityId: input.entityId,
          name: input.name,
          archivedAt: null,
          defaultBillingProfileId: null
        });
        saveIdempotencyResource(ctx.db, scope, input.idempotencyKey, 'project', project.projectId);
        return { resource: project, created: true };
      });

      return response(result.created ? 201 : 200, result.resource);
    }

    if (request.method === 'GET' && request.pathname === '/projects') {
      return response(200, listProjects(ctx.db, parseIncludeArchived(request.query)));
    }

    if (request.method === 'GET' && request.pathname.startsWith('/projects/')) {
      const projectId = request.pathname.slice('/projects/'.length).trim();
      const project = getProjectById(ctx.db, projectId);
      if (!project) {
        throw new CockpitError(404, 'project not found');
      }
      return response(200, project);
    }

    if (request.method === 'PATCH' && request.pathname.startsWith('/projects/')) {
      const projectId = request.pathname.slice('/projects/'.length).trim();
      const project = getProjectById(ctx.db, projectId);
      if (!project) {
        throw new CockpitError(404, 'project not found');
      }

      const body = parseBody(request.bodyText) as Record<string, unknown>;
      if (body.entityId !== undefined && body.entityId !== project.entityId) {
        throw new CockpitError(409, 'entityId is immutable');
      }

      const patch = parsePatchProjectInput(body);
      const archivedAt = patch.archived === null ? project.archivedAt : (patch.archived ? ctx.now() : null);

      let defaultBillingProfileId = project.defaultBillingProfileId;
      if (patch.defaultBillingProfileId !== undefined) {
        if (patch.defaultBillingProfileId === null) {
          defaultBillingProfileId = null;
        } else {
          const profile = getBillingProfileById(ctx.db, patch.defaultBillingProfileId);
          if (!profile) {
            throw new CockpitError(404, 'default billing profile not found');
          }
          if (profile.projectId !== project.projectId) {
            throw new CockpitError(409, 'default billing profile must belong to the project');
          }
          if (profile.archivedAt !== null) {
            throw new CockpitError(409, 'default billing profile must be active');
          }
          defaultBillingProfileId = profile.billingProfileId;
        }
      }

      const updated = updateProject(ctx.db, {
        ...project,
        name: patch.name ?? project.name,
        archivedAt,
        defaultBillingProfileId
      });
      return response(200, updated);
    }

    return null;
  });
}
