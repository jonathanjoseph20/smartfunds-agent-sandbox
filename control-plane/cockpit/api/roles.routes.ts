import { parseCreateRoleInput, parsePatchRoleInput } from '../models/role.ts';
import {
  createRole,
  getRoleById,
  getTeamById,
  listRolesByTeamId,
  nextCounterId,
  updateRole,
  withTransaction
} from '../storage/index.ts';
import { resolveIdempotentResource, saveIdempotencyResource } from '../service/idempotency.ts';
import { CockpitError } from '../service/invariants.ts';
import type { CockpitApiContext, CockpitApiRequest, CockpitApiResponse } from './_common.ts';
import { parseBody, parseIncludeArchived, response, withErrorHandling } from './_common.ts';

export function handleRolesRoutes(request: CockpitApiRequest, ctx: CockpitApiContext): CockpitApiResponse | null {
  return withErrorHandling(() => {
    if (request.method === 'POST' && request.pathname === '/roles') {
      const input = parseCreateRoleInput(parseBody(request.bodyText));
      const result = withTransaction(ctx.db, () => {
        if (!getTeamById(ctx.db, input.teamId)) {
          throw new CockpitError(404, 'team not found');
        }

        const scope = 'create-role';
        const existingReference = resolveIdempotentResource(ctx.db, scope, input.idempotencyKey);
        if (existingReference?.resourceType === 'role') {
          const existing = getRoleById(ctx.db, existingReference.resourceId);
          if (existing) {
            return { resource: existing, created: false };
          }
        }

        const role = createRole(ctx.db, {
          roleId: nextCounterId(ctx.db, 'role'),
          teamId: input.teamId,
          name: input.name,
          assigneeRef: input.assigneeRef,
          archivedAt: null
        });
        saveIdempotencyResource(ctx.db, scope, input.idempotencyKey, 'role', role.roleId);
        return { resource: role, created: true };
      });

      return response(result.created ? 201 : 200, result.resource);
    }

    if (request.method === 'GET' && request.pathname.startsWith('/teams/') && request.pathname.endsWith('/roles')) {
      const teamId = request.pathname.slice('/teams/'.length, -'/roles'.length);
      if (!getTeamById(ctx.db, teamId)) {
        throw new CockpitError(404, 'team not found');
      }
      return response(200, listRolesByTeamId(ctx.db, teamId, parseIncludeArchived(request.query)));
    }

    if (request.method === 'PATCH' && request.pathname.startsWith('/roles/')) {
      const roleId = request.pathname.slice('/roles/'.length).trim();
      const role = getRoleById(ctx.db, roleId);
      if (!role) {
        throw new CockpitError(404, 'role not found');
      }

      const body = parseBody(request.bodyText) as Record<string, unknown>;
      if (body.teamId !== undefined && body.teamId !== role.teamId) {
        throw new CockpitError(409, 'teamId is immutable');
      }

      const patch = parsePatchRoleInput(body);
      const updated = updateRole(ctx.db, {
        ...role,
        name: patch.name ?? role.name,
        assigneeRef: patch.assigneeRef === undefined ? role.assigneeRef : patch.assigneeRef,
        archivedAt: patch.archived === null ? role.archivedAt : (patch.archived ? ctx.now() : null)
      });

      return response(200, updated);
    }

    return null;
  });
}
