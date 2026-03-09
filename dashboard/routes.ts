import { ArtifactLoader } from './artifactLoader.ts';
import { ArtifactLoaderError } from './types.ts';

export interface ApiResponse {
  statusCode: number;
  body: unknown;
  headers?: Record<string, string>;
}

function jsonResponse(statusCode: number, body: unknown): ApiResponse {
  return {
    statusCode,
    body,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    }
  };
}

export function createDashboardApi(loader: ArtifactLoader) {
  async function handle(method: string, pathname: string): Promise<ApiResponse> {
    const normalizedMethod = method.toUpperCase();

    if (normalizedMethod !== 'GET') {
      return jsonResponse(405, { error: 'Method not allowed' });
    }

    if (pathname === '/api/runs') {
      return jsonResponse(200, loader.listRuns());
    }

    if (pathname.startsWith('/api/runs/')) {
      const runId = decodeURIComponent(pathname.slice('/api/runs/'.length));
      if (!runId) {
        return jsonResponse(404, { error: 'Run not found' });
      }

      try {
        return jsonResponse(200, loader.getRunDetails(runId));
      } catch (error) {
        if (error instanceof ArtifactLoaderError) {
          if (error.code === 'RUN_NOT_FOUND') {
            return jsonResponse(404, { error: error.message });
          }
          return jsonResponse(400, { error: error.message });
        }
        return jsonResponse(500, { error: 'Unexpected error' });
      }
    }

    if (pathname.startsWith('/api/artifacts/')) {
      const suffix = pathname.slice('/api/artifacts/'.length);
      const firstSlash = suffix.indexOf('/');
      if (firstSlash <= 0) {
        return jsonResponse(404, { error: 'Artifact not found' });
      }

      const runId = decodeURIComponent(suffix.slice(0, firstSlash));
      const fileName = decodeURIComponent(suffix.slice(firstSlash + 1));

      try {
        return jsonResponse(200, loader.getArtifactPreview(runId, fileName));
      } catch (error) {
        if (error instanceof ArtifactLoaderError) {
          if (error.code === 'RUN_NOT_FOUND' || error.code === 'ARTIFACT_NOT_FOUND') {
            return jsonResponse(404, { error: error.message });
          }
          if (error.code === 'INVALID_ARTIFACT_PATH') {
            return jsonResponse(400, { error: error.message });
          }
        }
        return jsonResponse(500, { error: 'Unexpected error' });
      }
    }

    return jsonResponse(404, { error: 'Not found' });
  }

  return { handle };
}
