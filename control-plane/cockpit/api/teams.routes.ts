import { parseCreateTeamInput, parsePatchTeamInput } from '../models/team.ts';
import {
  createTeam,
  getProjectById,
  getTeamById,
  listTeamsByProjectId,
  nextCounterId,
  updateTeam,
  withTransaction
} from '../storage/index.ts';
import { resolveIdempotentResource, saveIdempotencyResource } from '../service/idempotency.ts';
import { CockpitError } from '../service/invariants.ts';
import type { CockpitApiContext, CockpitApiRequest, CockpitApiResponse } from './_common.ts';
import { parseBody, parseIncludeArchived, response, withErrorHandling } from './_common.ts';

export function handleTeamsRoutes(request: CockpitApiRequest, ctx: CockpitApiContext): CockpitApiResponse | null {
  return withErrorHandling(() => {
    if (request.method === 'POST' && request.pathname === '/teams') {
      const input = parseCreateTeamInput(parseBody(request.bodyText));
      const result = withTransaction(ctx.db, () => {
        if (!getProjectById(ctx.db, input.projectId)) {
          throw new CockpitError(404, 'project not found');
        }

        const scope = 'create-team';
        const existingReference = resolveIdempotentResource(ctx.db, scope, input.idempotencyKey);
        if (existingReference?.resourceType === 'team') {
          const existing = getTeamById(ctx.db, existingReference.resourceId);
          if (existing) {
            return { resource: existing, created: false };
          }
        }

        const team = createTeam(ctx.db, {
          teamId: nextCounterId(ctx.db, 'team'),
          projectId: input.projectId,
          name: input.name,
          archivedAt: null
        });
        saveIdempotencyResource(ctx.db, scope, input.idempotencyKey, 'team', team.teamId);
        return { resource: team, created: true };
      });

      return response(result.created ? 201 : 200, result.resource);
    }

    if (request.method === 'GET' && request.pathname.startsWith('/projects/') && request.pathname.endsWith('/teams')) {
      const projectId = request.pathname.slice('/projects/'.length, -'/teams'.length);
      if (!getProjectById(ctx.db, projectId)) {
        throw new CockpitError(404, 'project not found');
      }
      return response(200, listTeamsByProjectId(ctx.db, projectId, parseIncludeArchived(request.query)));
    }

    if (request.method === 'PATCH' && request.pathname.startsWith('/teams/')) {
      const teamId = request.pathname.slice('/teams/'.length).trim();
      const team = getTeamById(ctx.db, teamId);
      if (!team) {
        throw new CockpitError(404, 'team not found');
      }

      const body = parseBody(request.bodyText) as Record<string, unknown>;
      if (body.projectId !== undefined && body.projectId !== team.projectId) {
        throw new CockpitError(409, 'projectId is immutable');
      }

      const patch = parsePatchTeamInput(body);
      const updated = updateTeam(ctx.db, {
        ...team,
        name: patch.name ?? team.name,
        archivedAt: patch.archived === null ? team.archivedAt : (patch.archived ? ctx.now() : null)
      });

      return response(200, updated);
    }

    return null;
  });
}
