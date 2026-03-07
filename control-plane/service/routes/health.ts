import type { RouteDefinition } from '../app.ts';

export function healthRoutes(): RouteDefinition[] {
  return [{
    method: 'GET',
    path: '/health',
    handle: async () => ({ status: 'ok' })
  }];
}
