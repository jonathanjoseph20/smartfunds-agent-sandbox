import { createServer } from 'node:http';

import { createApp } from './app.ts';
import { loadConfig } from './config/config.ts';
import type { RuntimeServiceConfig } from './config/schema.ts';

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });

    req.on('error', reject);
  });
}

export async function startRuntimeServer(): Promise<void> {
  const config = loadConfig();
  const app = createApp({ config });

  function resolveCorsOrigin(origin: string | undefined): string {
    if (typeof origin === 'string' && origin.trim().length > 0) {
      if (origin === config.corsOrigin) {
        return origin;
      }

      if (origin.endsWith('.app.github.dev')) {
        return origin;
      }

      if (config.env !== 'production') {
        return origin;
      }
    }

    return config.corsOrigin;
  }

  function corsHeaders(input: {
    origin: string | undefined;
    requestedHeaders: string | undefined;
  }): Record<string, string> {
    return {
      'access-control-allow-origin': resolveCorsOrigin(input.origin),
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': input.requestedHeaders && input.requestedHeaders.trim().length > 0
        ? input.requestedHeaders
        : 'content-type,x-request-id',
      'access-control-max-age': '600',
      vary: 'origin'
    };
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    const requestedHeaders = typeof req.headers['access-control-request-headers'] === 'string'
      ? req.headers['access-control-request-headers']
      : undefined;
    const baseCorsHeaders = corsHeaders({
      origin,
      requestedHeaders
    });

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      for (const [key, value] of Object.entries(baseCorsHeaders)) {
        res.setHeader(key, value);
      }
      res.end('\n');
      return;
    }

    const bodyText = req.method === 'GET' || req.method === 'OPTIONS' ? null : await readBody(req);

    const response = await app.dispatch({
      method: req.method ?? 'GET',
      pathname: url.pathname,
      query: url.searchParams,
      bodyText,
      headers: Object.fromEntries(
        Object.entries(req.headers).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.join(',') : value ?? undefined
        ])
      )
    });

    res.statusCode = response.statusCode;
    for (const [key, value] of Object.entries(baseCorsHeaders)) {
      res.setHeader(key, value);
    }
    for (const [key, value] of Object.entries(response.headers)) {
      res.setHeader(key, value);
    }
    res.end(app.toHttpBody(response.payload));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.runtimePort, '0.0.0.0', () => {
      server.off('error', reject);
      process.stdout.write(`Runtime API listening on ${String(config.runtimePort)}\n`);
      resolve();
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startRuntimeServer().catch((error) => {
    process.stdout.write(`${String(error instanceof Error ? error.message : 'runtime_server_start_failed')}\n`);
    process.exit(1);
  });
}
