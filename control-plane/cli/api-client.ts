import { canonicalStringify } from '../finance/determinism.ts';

interface ApiSuccess<T> {
  success: true;
  payload: T;
  meta: {
    source: string;
    version: string;
  };
}

interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface OperatorApiClient {
  listMissions: () => Promise<unknown>;
  inspectMission: (missionId: string) => Promise<unknown>;
  startMission: (missionId: string, params: Record<string, string>) => Promise<unknown>;
  cancelMission: (missionId: string) => Promise<unknown>;
  listWorkflows: () => Promise<unknown>;
  inspectWorkflowRun: (runId: string) => Promise<unknown>;
  traceWorkflowRun: (runId: string) => Promise<unknown>;
  retryWorkflowNode: (runId: string, nodeId: string) => Promise<unknown>;
  resumeWorkflow: (runId: string) => Promise<unknown>;
  cancelWorkflow: (runId: string) => Promise<unknown>;
}

function resolveBaseUrl(baseUrl?: string): string {
  const resolved = baseUrl ?? process.env.SMARTFUNDS_RUNTIME_BASE_URL ?? 'http://127.0.0.1:3100';
  return resolved.replace(/\/$/, '');
}

async function request<T>(
  baseUrl: string,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'content-type': 'application/json'
    },
    body: body === undefined ? undefined : canonicalStringify(body)
  });

  const parsed = await response.json() as ApiSuccess<T> | ApiFailure;

  if (!response.ok) {
    if ('success' in parsed && parsed.success === false) {
      throw new Error(`${parsed.error.code}: ${parsed.error.message}`);
    }
    throw new Error(`HTTP_ERROR: ${String(response.status)}`);
  }

  if (!('success' in parsed) || parsed.success !== true) {
    throw new Error('HTTP_ERROR: malformed_response');
  }

  return parsed.payload;
}

export function createOperatorApiClient(baseUrl?: string): OperatorApiClient {
  const resolvedBaseUrl = resolveBaseUrl(baseUrl);

  return {
    listMissions: async () => request(resolvedBaseUrl, 'GET', '/missions'),
    inspectMission: async (missionId) => request(resolvedBaseUrl, 'GET', `/missions/${missionId}`),
    startMission: async (missionId, params) => request(resolvedBaseUrl, 'POST', `/missions/${missionId}/start`, { params }),
    cancelMission: async (missionId) => request(resolvedBaseUrl, 'POST', `/missions/${missionId}/cancel`),
    listWorkflows: async () => request(resolvedBaseUrl, 'GET', '/runs'),
    inspectWorkflowRun: async (runId) => request(resolvedBaseUrl, 'GET', `/runs/${runId}`),
    traceWorkflowRun: async (runId) => request(resolvedBaseUrl, 'GET', `/runs/${runId}/trace`),
    retryWorkflowNode: async (runId, nodeId) => request(resolvedBaseUrl, 'POST', `/runs/${runId}/retry`, { nodeId }),
    resumeWorkflow: async (runId) => request(resolvedBaseUrl, 'POST', `/runs/${runId}/resume`),
    cancelWorkflow: async (runId) => request(resolvedBaseUrl, 'POST', `/runs/${runId}/cancel`)
  };
}
