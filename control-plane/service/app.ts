import { createMissionService } from '../operator/mission-service.ts';
import { createRuntimeService } from '../operator/runtime-service.ts';
import { createWorkflowService } from '../operator/workflow-service.ts';
import { canonicalStringify } from '../finance/determinism.ts';
import { loadConfig, type RuntimeServiceConfig } from './config/config.ts';
import { createMissionHandlers } from './handlers/mission-handlers.ts';
import { createRunHandlers } from './handlers/run-handlers.ts';
import { createWorkflowHandlers } from './handlers/workflow-handlers.ts';
import { toErrorResponse } from './middleware/error-handler.ts';
import { createRequestLogger, type RequestLogger } from './middleware/logging.ts';
import { createRequestIdAllocator } from './middleware/request-id.ts';
import { healthRoutes } from './routes/health.ts';
import { missionRoutes } from './routes/missions.ts';
import { operatorRoutes } from './routes/operator.ts';
import { runRoutes } from './routes/runs.ts';
import { workflowRoutes } from './routes/workflows.ts';

export interface RouteContext {
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  requestId: string;
}

export interface RouteDefinition {
  method: 'GET' | 'POST' | 'OPTIONS';
  path: string;
  successStatusCode?: number;
  handle: (context: RouteContext) => Promise<unknown> | unknown;
}

export interface AppDispatchRequest {
  method: string;
  pathname: string;
  query: URLSearchParams;
  bodyText: string | null;
  headers: Record<string, string | undefined>;
}

export interface AppDispatchResponse {
  statusCode: number;
  payload: unknown;
  headers: Record<string, string>;
}

const RESPONSE_META = {
  source: 'operator-runtime-api',
  version: 'v1'
} as const;

function success(payload: unknown): unknown {
  return {
    success: true,
    payload,
    meta: RESPONSE_META
  };
}

function parseBody(bodyText: string | null): unknown {
  if (!bodyText || bodyText.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    throw {
      code: 'BAD_REQUEST',
      message: 'invalid_json',
      statusCode: 400
    };
  }
}

function normalizeHeaderMap(headers: Record<string, string | undefined>): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
}

function matchPath(routePath: string, requestPath: string): { matched: boolean; params: Record<string, string> } {
  const routeParts = routePath.split('/').filter((part) => part.length > 0);
  const requestParts = requestPath.split('/').filter((part) => part.length > 0);

  if (routeParts.length !== requestParts.length) {
    return { matched: false, params: {} };
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < routeParts.length; i += 1) {
    const routePart = routeParts[i] ?? '';
    const requestPart = requestParts[i] ?? '';

    if (routePart.startsWith(':')) {
      params[routePart.slice(1)] = requestPart;
      continue;
    }

    if (routePart !== requestPart) {
      return { matched: false, params: {} };
    }
  }

  return { matched: true, params };
}

function buildCorsHeaders(config: RuntimeServiceConfig, origin: string | undefined): Record<string, string> {
  const allowOrigin = origin === config.corsOrigin ? origin : config.corsOrigin;
  return {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,x-request-id',
    'access-control-max-age': '600',
    vary: 'origin'
  };
}

export function createApp(options: {
  config?: RuntimeServiceConfig;
  logger?: RequestLogger;
  services?: {
    missionService?: ReturnType<typeof createMissionService>;
    workflowService?: ReturnType<typeof createWorkflowService>;
    runtimeService?: ReturnType<typeof createRuntimeService>;
  };
} = {}) {
  const config = options.config ?? loadConfig();
  const logger = options.logger ?? createRequestLogger();
  const nextRequestId = createRequestIdAllocator();

  const missionService = options.services?.missionService ?? createMissionService();
  const workflowService = options.services?.workflowService ?? createWorkflowService();
  const runtimeService = options.services?.runtimeService ?? createRuntimeService();

  const routes: RouteDefinition[] = [
    ...healthRoutes(),
    ...missionRoutes(createMissionHandlers(missionService)),
    ...workflowRoutes(createWorkflowHandlers(workflowService)),
    ...runRoutes(createRunHandlers(workflowService, runtimeService)),
    ...operatorRoutes()
  ];

  async function dispatch(request: AppDispatchRequest): Promise<AppDispatchResponse> {
    const headers = normalizeHeaderMap(request.headers);
    const requestId = nextRequestId();
    const corsHeaders = buildCorsHeaders(config, headers.origin);

    if (request.method.toUpperCase() === 'OPTIONS') {
      return {
        statusCode: 204,
        payload: null,
        headers: {
          ...corsHeaders,
          'content-type': 'application/json; charset=utf-8',
          'x-request-id': requestId
        }
      };
    }

    const route = routes.find((entry) => {
      if (entry.method !== request.method.toUpperCase()) {
        return false;
      }

      return matchPath(entry.path, request.pathname).matched;
    });

    if (!route) {
      const response = {
        statusCode: 404,
        payload: {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'not_found',
            details: {}
          }
        },
        headers: {
          ...corsHeaders,
          'content-type': 'application/json; charset=utf-8',
          'x-request-id': requestId
        }
      };

      logger({ requestId, method: request.method.toUpperCase(), pathname: request.pathname, statusCode: response.statusCode });
      return response;
    }

    const params = matchPath(route.path, request.pathname).params;

    try {
      const body = parseBody(request.bodyText);
      const payload = await route.handle({
        params,
        query: request.query,
        body,
        requestId
      });

      const response = {
        statusCode: route.successStatusCode ?? 200,
        payload: success(payload),
        headers: {
          ...corsHeaders,
          'content-type': 'application/json; charset=utf-8',
          'x-request-id': requestId
        }
      };
      logger({ requestId, method: request.method.toUpperCase(), pathname: request.pathname, statusCode: response.statusCode });
      return response;
    } catch (error) {
      const handled = toErrorResponse(error);
      logger({ requestId, method: request.method.toUpperCase(), pathname: request.pathname, statusCode: handled.statusCode });
      return {
        statusCode: handled.statusCode,
        payload: handled.payload,
        headers: {
          ...corsHeaders,
          'content-type': 'application/json; charset=utf-8',
          'x-request-id': requestId
        }
      };
    }
  }

  function toHttpBody(payload: unknown): string {
    if (payload === null) {
      return '\n';
    }

    return `${canonicalStringify(payload)}\n`;
  }

  return {
    config,
    dispatch,
    toHttpBody
  };
}
