import { canonicalStringify } from '../../finance/determinism.ts';
import type { Goal } from '../models/goal.ts';
import { parseCreateGoalInput, parsePatchGoalInput } from '../models/goal.ts';
import {
  createGoal,
  getGoalById,
  getProjectById,
  getTeamById,
  listGoalsByProjectId,
  nextCounterId,
  updateGoal,
  withTransaction
} from '../storage/index.ts';
import { resolveIdempotentResource, saveIdempotencyResource } from '../service/idempotency.ts';
import { CockpitError } from '../service/invariants.ts';
import type { CockpitApiContext, CockpitApiRequest, CockpitApiResponse } from './_common.ts';
import { jsonOrNull, parseBody, parseIncludeArchived, response, withErrorHandling } from './_common.ts';

function formatGoal(goal: Goal) {
  return {
    ...goal,
    specJson: jsonOrNull(goal.specJson)
  };
}

export function handleGoalsRoutes(request: CockpitApiRequest, ctx: CockpitApiContext): CockpitApiResponse | null {
  return withErrorHandling(() => {
    if (request.method === 'POST' && request.pathname === '/goals') {
      const input = parseCreateGoalInput(parseBody(request.bodyText));
      const result = withTransaction(ctx.db, () => {
        const project = getProjectById(ctx.db, input.projectId);
        if (!project) {
          throw new CockpitError(404, 'project not found');
        }
        const team = getTeamById(ctx.db, input.teamId);
        if (!team) {
          throw new CockpitError(404, 'team not found');
        }
        if (team.projectId !== project.projectId) {
          throw new CockpitError(409, 'goal team must belong to goal project');
        }

        const scope = 'create-goal';
        const existingReference = resolveIdempotentResource(ctx.db, scope, input.idempotencyKey);
        if (existingReference?.resourceType === 'goal') {
          const existing = getGoalById(ctx.db, existingReference.resourceId);
          if (existing) {
            return { resource: existing, created: false };
          }
        }

        const goal = createGoal(ctx.db, {
          goalId: nextCounterId(ctx.db, 'goal'),
          projectId: input.projectId,
          teamId: input.teamId,
          title: input.title,
          goalType: input.goalType,
          specRef: input.specRef,
          specJson: input.specJson ? canonicalStringify(input.specJson) : null,
          archivedAt: null
        });
        saveIdempotencyResource(ctx.db, scope, input.idempotencyKey, 'goal', goal.goalId);
        return { resource: goal, created: true };
      });

      return response(result.created ? 201 : 200, formatGoal(result.resource));
    }

    if (request.method === 'GET' && request.pathname.startsWith('/projects/') && request.pathname.endsWith('/goals')) {
      const projectId = request.pathname.slice('/projects/'.length, -'/goals'.length);
      if (!getProjectById(ctx.db, projectId)) {
        throw new CockpitError(404, 'project not found');
      }
      return response(200, listGoalsByProjectId(ctx.db, projectId, parseIncludeArchived(request.query)).map(formatGoal));
    }

    if (request.method === 'GET' && request.pathname.startsWith('/goals/')) {
      const goalId = request.pathname.slice('/goals/'.length).trim();
      const goal = getGoalById(ctx.db, goalId);
      if (!goal) {
        throw new CockpitError(404, 'goal not found');
      }
      return response(200, formatGoal(goal));
    }

    if (request.method === 'PATCH' && request.pathname.startsWith('/goals/')) {
      const goalId = request.pathname.slice('/goals/'.length).trim();
      const goal = getGoalById(ctx.db, goalId);
      if (!goal) {
        throw new CockpitError(404, 'goal not found');
      }

      const body = parseBody(request.bodyText) as Record<string, unknown>;
      if (body.projectId !== undefined && body.projectId !== goal.projectId) {
        throw new CockpitError(409, 'projectId is immutable');
      }
      if (body.teamId !== undefined && body.teamId !== goal.teamId) {
        throw new CockpitError(409, 'teamId is immutable');
      }

      const patch = parsePatchGoalInput(body);
      const updated = updateGoal(ctx.db, {
        ...goal,
        title: patch.title ?? goal.title,
        goalType: patch.goalType ?? goal.goalType,
        specRef: patch.specRef === undefined ? goal.specRef : patch.specRef,
        specJson: patch.specJson === undefined ? goal.specJson : (patch.specJson ? canonicalStringify(patch.specJson) : null),
        archivedAt: patch.archived === null ? goal.archivedAt : (patch.archived ? ctx.now() : null)
      });

      return response(200, formatGoal(updated));
    }

    return null;
  });
}
