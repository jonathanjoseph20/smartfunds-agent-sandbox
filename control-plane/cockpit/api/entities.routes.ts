import { parseCreateEntityInput } from '../models/entity.ts';
import { createEntity, getEntityById, nextCounterId, withTransaction } from '../storage/index.ts';
import { resolveIdempotentResource, saveIdempotencyResource } from '../service/idempotency.ts';
import { CockpitError } from '../service/invariants.ts';
import type { CockpitApiContext, CockpitApiRequest, CockpitApiResponse } from './_common.ts';
import { parseBody, response, withErrorHandling } from './_common.ts';

export function handleEntitiesRoutes(request: CockpitApiRequest, ctx: CockpitApiContext): CockpitApiResponse | null {
  return withErrorHandling(() => {
    if (request.method === 'POST' && request.pathname === '/entities') {
      const input = parseCreateEntityInput(parseBody(request.bodyText));
      const result = withTransaction(ctx.db, () => {
        const scope = 'create-entity';
        const existingReference = resolveIdempotentResource(ctx.db, scope, input.idempotencyKey);
        if (existingReference?.resourceType === 'entity') {
          const existing = getEntityById(ctx.db, existingReference.resourceId);
          if (existing) {
            return { resource: existing, created: false };
          }
        }

        const entity = createEntity(ctx.db, {
          entityId: nextCounterId(ctx.db, 'entity'),
          name: input.name
        });
        saveIdempotencyResource(ctx.db, scope, input.idempotencyKey, 'entity', entity.entityId);
        return { resource: entity, created: true };
      });

      return response(result.created ? 201 : 200, result.resource);
    }

    if (request.method === 'GET' && request.pathname.startsWith('/entities/')) {
      const entityId = request.pathname.slice('/entities/'.length).trim();
      if (!entityId) {
        throw new CockpitError(404, 'entity not found');
      }
      const entity = getEntityById(ctx.db, entityId);
      if (!entity) {
        throw new CockpitError(404, 'entity not found');
      }
      return response(200, entity);
    }

    return null;
  });
}
