import { createServer } from 'node:http';

import { createApp } from './app.ts';
import { loadConfig } from './config/config.ts';

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

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
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
