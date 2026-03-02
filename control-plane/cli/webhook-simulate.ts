import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';
import { normalizeGithubEvent } from '../webhooks/github/normalize.ts';
import type { SupportedGithubEventType } from '../webhooks/github/types.ts';

function parseArgs(argv: string[]): {
  eventType: SupportedGithubEventType;
  deliveryId: string;
  filePath: string | null;
} {
  let eventType: SupportedGithubEventType | null = null;
  let deliveryId: string | null = null;
  let filePath: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--event') {
      const value = argv[index + 1];
      if (value === 'check_run' || value === 'workflow_run') {
        eventType = value;
        index += 1;
        continue;
      }
      throw new Error('Usage: npm run webhook:simulate -- --event <check_run|workflow_run> --delivery <id> [--file <path>]');
    }
    if (arg === '--delivery') {
      const value = argv[index + 1];
      if (!value || value.trim().length === 0) {
        throw new Error('Usage: npm run webhook:simulate -- --event <check_run|workflow_run> --delivery <id> [--file <path>]');
      }
      deliveryId = value;
      index += 1;
      continue;
    }
    if (arg === '--file') {
      const value = argv[index + 1];
      if (!value || value.trim().length === 0) {
        throw new Error('Usage: npm run webhook:simulate -- --event <check_run|workflow_run> --delivery <id> [--file <path>]');
      }
      filePath = value;
      index += 1;
      continue;
    }

    throw new Error('Usage: npm run webhook:simulate -- --event <check_run|workflow_run> --delivery <id> [--file <path>]');
  }

  if (!eventType || !deliveryId) {
    throw new Error('Usage: npm run webhook:simulate -- --event <check_run|workflow_run> --delivery <id> [--file <path>]');
  }

  return {
    eventType,
    deliveryId,
    filePath
  };
}

function parsePayload(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error('invalid_json');
  }
}

export function simulateGithubWebhook(args: {
  eventType: SupportedGithubEventType;
  deliveryId: string;
  payload: unknown;
}): string {
  const normalized = normalizeGithubEvent({
    eventType: args.eventType,
    deliveryId: args.deliveryId,
    payload: args.payload
  });

  return canonicalStringify(normalized.envelope);
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const raw = parsed.filePath
    ? fs.readFileSync(parsed.filePath, 'utf8')
    : fs.readFileSync(0, 'utf8');
  const payload = parsePayload(raw);

  process.stdout.write(`${simulateGithubWebhook({
    eventType: parsed.eventType,
    deliveryId: parsed.deliveryId,
    payload
  })}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exit(1);
  });
}
