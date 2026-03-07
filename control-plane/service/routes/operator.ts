import { createOperatorHandlers } from '../handlers/operator-handlers.ts';
import type { RouteDefinition } from '../app.ts';

export function operatorRoutes(): RouteDefinition[] {
  const handlers = createOperatorHandlers();
  return [{
    method: 'GET',
    path: '/runtime/limits',
    handle: async () => handlers.getRuntimeLimits()
  }];
}
