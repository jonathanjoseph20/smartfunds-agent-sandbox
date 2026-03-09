import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';

import { ArtifactLoader } from './artifactLoader.ts';
import { createDashboardApi } from './routes.ts';

const uiRoot = path.resolve('.', 'dashboard', 'ui');
const port = Number.parseInt(process.env.PORT ?? '3000', 10);

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

function sendJson(res: import('node:http').ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(`${JSON.stringify(body)}\n`);
}

function sendFile(res: import('node:http').ServerResponse, filePath: string): void {
  res.statusCode = 200;
  res.setHeader('content-type', contentTypeFor(filePath));
  res.end(fs.readFileSync(filePath));
}

function resolveUiPath(pathname: string): string | null {
  const cleanPath = pathname === '/' ? '/index.html' : pathname;
  const resolved = path.resolve(uiRoot, `.${cleanPath}`);
  if (!resolved.startsWith(`${uiRoot}${path.sep}`) && resolved !== path.join(uiRoot, 'index.html')) {
    return null;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return null;
  }
  return resolved;
}

export function startDashboardServer(): Promise<void> {
  const loader = new ArtifactLoader(path.join('.', 'artifacts'));
  const api = createDashboardApi(loader);

  const server = createServer(async (req, res) => {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);

    if (url.pathname.startsWith('/api/')) {
      const apiResponse = await api.handle(method, url.pathname);
      for (const [key, value] of Object.entries(apiResponse.headers ?? {})) {
        res.setHeader(key, value);
      }
      res.statusCode = apiResponse.statusCode;
      res.end(`${JSON.stringify(apiResponse.body)}\n`);
      return;
    }

    if (method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }

    const filePath = resolveUiPath(url.pathname);
    if (filePath) {
      sendFile(res, filePath);
      return;
    }

    if (url.pathname === '/' || !path.extname(url.pathname)) {
      const indexPath = path.join(uiRoot, 'index.html');
      if (fs.existsSync(indexPath)) {
        sendFile(res, indexPath);
        return;
      }
    }

    sendJson(res, 404, { error: 'Not found' });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => {
      server.off('error', reject);
      process.stdout.write(`Dashboard listening on http://localhost:${String(port)}\n`);
      resolve();
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startDashboardServer().catch((error) => {
    process.stdout.write(`${String(error instanceof Error ? error.message : 'dashboard_server_start_failed')}\n`);
    process.exit(1);
  });
}
