import type { DatabaseSync } from 'node:sqlite';

import { handleApprovalsRoutes } from './approvals.routes.ts';
import type { CockpitApiRequest, CockpitApiResponse } from './_common.ts';
import { handleArtifactsRoutes } from './artifacts.routes.ts';
import { handleBillingRoutes } from './billing.routes.ts';
import { handleEntitiesRoutes } from './entities.routes.ts';
import { handleGoalsRoutes } from './goals.routes.ts';
import { handleProjectsRoutes } from './projects.routes.ts';
import { handleRolesRoutes } from './roles.routes.ts';
import { handleRunsRoutes } from './runs.routes.ts';
import { handleTeamsRoutes } from './teams.routes.ts';

export interface CockpitRouterOptions {
  db: DatabaseSync;
  now?: () => string;
  prefix?: string;
}

export function createCockpitRouter(options: CockpitRouterOptions): (request: CockpitApiRequest) => CockpitApiResponse | null {
  const now = options.now ?? (() => new Date().toISOString());
  const prefix = (options.prefix ?? '/api').replace(/\/+$/, '');

  return (request) => {
    if (!request.pathname.startsWith(`${prefix}/`)) {
      return null;
    }

    const normalizedPath = request.pathname.slice(prefix.length);
    const normalizedRequest: CockpitApiRequest = {
      ...request,
      pathname: normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
    };

    const ctx = {
      db: options.db,
      now
    };

    const handlers = [
      handleTeamsRoutes,
      handleRolesRoutes,
      handleGoalsRoutes,
      handleRunsRoutes,
      handleApprovalsRoutes,
      handleArtifactsRoutes,
      handleBillingRoutes,
      handleEntitiesRoutes,
      handleProjectsRoutes
    ];

    for (const handler of handlers) {
      const result = handler(normalizedRequest, ctx);
      if (result) {
        return result;
      }
    }

    return {
      statusCode: 404,
      payload: { error: 'not found' }
    };
  };
}
