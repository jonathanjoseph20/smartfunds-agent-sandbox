import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ArtifactLoader } from '../artifactLoader.ts';
import { createDashboardApi } from '../routes.ts';

const fixturesRoot = path.join('dashboard', '__tests__', 'tmp-routes-artifacts');

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

beforeEach(() => {
  fs.rmSync(fixturesRoot, { recursive: true, force: true });
  fs.mkdirSync(fixturesRoot, { recursive: true });
  writeFile(path.join(fixturesRoot, 'mission-a', 'run_9001', 'report.md'), '# Report\n');
  writeFile(path.join(fixturesRoot, 'mission-a', 'run_9001', 'dataset.csv'), 'a,b\n1,2\n');
});

afterEach(() => {
  fs.rmSync(fixturesRoot, { recursive: true, force: true });
});

describe('dashboard routes', () => {
  it('T-S86-RT1 GET /api/runs returns 200 array', async () => {
    const api = createDashboardApi(new ArtifactLoader(fixturesRoot));
    const response = await api.handle('GET', '/api/runs');

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([{ runId: 'run_9001', missionId: 'mission-a' }]);
  });

  it('T-S86-RT2 GET /api/runs/:runId returns 200 or 404', async () => {
    const api = createDashboardApi(new ArtifactLoader(fixturesRoot));

    const ok = await api.handle('GET', '/api/runs/run_9001');
    expect(ok.statusCode).toBe(200);

    const missing = await api.handle('GET', '/api/runs/run_missing');
    expect(missing.statusCode).toBe(404);
    expect(missing.body).toEqual({ error: 'Run not found' });
  });

  it('T-S86-RT3 GET /api/artifacts/:runId/:fileName returns 200 or 404', async () => {
    const api = createDashboardApi(new ArtifactLoader(fixturesRoot));

    const ok = await api.handle('GET', '/api/artifacts/run_9001/report.md');
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toMatchObject({
      runId: 'run_9001',
      fileName: 'report.md',
      previewKind: 'markdown'
    });

    const missing = await api.handle('GET', '/api/artifacts/run_9001/missing.md');
    expect(missing.statusCode).toBe(404);
    expect(missing.body).toEqual({ error: 'Artifact not found' });
  });

  it('T-S86-RT4 invalid artifact path returns 400', async () => {
    const api = createDashboardApi(new ArtifactLoader(fixturesRoot));
    const response = await api.handle('GET', '/api/artifacts/run_9001/..%2Fsecret.txt');

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid artifact path' });
  });

  it('T-S86-RT5 non-GET methods return 405', async () => {
    const api = createDashboardApi(new ArtifactLoader(fixturesRoot));
    const response = await api.handle('POST', '/api/runs');

    expect(response.statusCode).toBe(405);
    expect(response.body).toEqual({ error: 'Method not allowed' });
  });
});
