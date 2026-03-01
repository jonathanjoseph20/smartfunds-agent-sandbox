import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import {
  ERR_ALREADY_FUNDED,
  ERR_AMOUNT_MISMATCH,
  ERR_DUPLICATE_RECEIPT,
  ERR_PAYER_UNAUTHORIZED,
  OK_RECEIPT_ACCEPTED
} from '../domain/receipt-validator.ts';
import { runSwarmExecution } from '../swarms/swarmExecutor.ts';
import { createServiceDispatcher } from './index.ts';
import type { ServiceDispatchResponse } from './index.ts';
import { resolveHandlerRoute } from './handlers/router.ts';
import { clearServiceDbRegistryForTests, getServiceDb } from './storage/db.ts';
import { computeEventId, getEventById } from './storage/events.ts';
import { countJournalByRefId, computeSwarmRunId, getJournalByRunId } from './storage/journal.ts';
import { getIssuanceById, getReceiptById } from './storage/receipts.ts';
import { computeTaskId, getTaskById } from './storage/tasks.ts';

const TEST_ADAPTER_KEY = '__SMARTFUNDS_SWARM_EXECUTION_ADAPTER__';
const TEST_DB_PATH = ':memory:';
const FIXED_NOW = '2026-02-28T00:00:00.000Z';

interface TestAdapter {
  branchExistsLocal: (branchName: string) => boolean;
  branchExistsRemote: (branchName: string) => boolean;
  checkoutNewBranch: (branchName: string) => void;
  stageFile: (filePath: string) => void;
  commit: (message: string) => void;
  pushBranch: (branchName: string) => void;
  createPullRequest: (params: { base: string; head: string; title: string; body: string; labels: string[] }) => { prCreated: boolean };
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createFixtureRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'service-runtime-'));

  writeJson(path.join(root, 'control-plane/projects/core-app.json'), {
    projectId: 'core-app',
    ownedPaths: ['control-plane/swarms/runtime-artifacts/core-app/**']
  });

  writeJson(path.join(root, 'control-plane/teams/dev-team.json'), {
    teamId: 'dev-team',
    projectId: 'core-app',
    executionMode: 'structured',
    ownedPaths: ['control-plane/swarms/runtime-artifacts/core-app/**']
  });

  writeJson(path.join(root, 'control-plane/swarms/dev-team.json'), {
    swarmId: 'dev-team',
    project: 'core-app',
    team: 'dev-team',
    executionMode: 'structured'
  });

  writeJson(path.join(root, 'control-plane/entities/registry.json'), [
    {
      entityId: 'core-app-entity',
      legalName: 'Core App Entity',
      projects: ['core-app'],
      complianceProfile: 'phase-1',
      custodyMode: 'non_custodial'
    }
  ]);

  writeJson(path.join(root, 'control-plane/entities/rails.json'), {
    version: 1,
    entities: [
      {
        entityId: 'core-app-entity',
        railProfile: 'structured-only'
      }
    ]
  });

  return root;
}

function createAdapter(): TestAdapter {
  const localBranches = new Set<string>();
  const remoteBranches = new Set<string>();

  return {
    branchExistsLocal: (branchName) => localBranches.has(branchName),
    branchExistsRemote: (branchName) => remoteBranches.has(branchName),
    checkoutNewBranch: (branchName) => {
      localBranches.add(branchName);
    },
    stageFile: () => {
      // no-op
    },
    commit: () => {
      // no-op
    },
    pushBranch: (branchName) => {
      remoteBranches.add(branchName);
    },
    createPullRequest: () => {
      return { prCreated: true };
    }
  };
}

function seedReceiptRegistry(): void {
  const db = getServiceDb(TEST_DB_PATH);

  db.prepare(`
    INSERT INTO deals (deal_id, receiving_account_ref)
    VALUES (?, ?)
  `).run('deal_001', 'acct_001');

  db.prepare(`
    INSERT INTO subscriptions (
      subscription_id,
      deal_id,
      entity_id,
      expected_amount,
      rail_type,
      currency,
      authorized_wallets_canonical,
      expected_wire_sender_ref
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'sub_001',
    'deal_001',
    'entity_001',
    '1000.00',
    'evm_usdc',
    'USDC',
    '["0xwallet_1","0xwallet_2"]',
    null
  );

  db.prepare(`
    INSERT INTO subscriptions (
      subscription_id,
      deal_id,
      entity_id,
      expected_amount,
      rail_type,
      currency,
      authorized_wallets_canonical,
      expected_wire_sender_ref
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'sub_002',
    'deal_001',
    'entity_001',
    '1000.00',
    'evm_usdc',
    'USDC',
    '["0xwallet_1"]',
    null
  );
}

function buildReceiptPayload(overrides: Partial<Record<keyof ReturnType<typeof baseReceiptPayload>, unknown>> = {}) {
  return {
    ...baseReceiptPayload(),
    ...overrides
  };
}

function baseReceiptPayload() {
  return {
    subscriptionId: 'sub_001',
    dealId: 'deal_001',
    entityId: 'entity_001',
    railType: 'evm_usdc' as const,
    amount: '1000.00',
    currency: 'USDC' as const,
    payerRef: '0xwallet_1',
    receiptRef: 'rcpt_001',
    toAccountRef: 'acct_001',
    chainId: 1
  };
}

describe.sequential('service integration', () => {
  let previousCwd = '';
  let fixtureRoot = '';
  let dispatch: ((method: string, pathname: string, body: unknown) => Promise<ServiceDispatchResponse>) | null = null;

  beforeEach(() => {
    clearServiceDbRegistryForTests();
    fixtureRoot = createFixtureRoot();
    previousCwd = process.cwd();
    process.chdir(fixtureRoot);
    (globalThis as Record<string, unknown>)[TEST_ADAPTER_KEY] = createAdapter();

    const runtimeDispatch = createServiceDispatcher({ dbPath: TEST_DB_PATH, now: () => FIXED_NOW });
    dispatch = (method, pathname, body) => runtimeDispatch({
      method,
      pathname,
      bodyText: body === null ? null : JSON.stringify(body)
    });

    seedReceiptRegistry();
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>)[TEST_ADAPTER_KEY];
    process.chdir(previousCwd);
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
    clearServiceDbRegistryForTests();
    dispatch = null;
  });

  it('POST /execute returns executor result unchanged and writes deterministic journal row', async () => {
    const executeInput = {
      swarmId: 'dev-team',
      projectId: 'core-app',
      mode: 'structured',
      intent: 'sprint-42-runtime'
    };

    const serviceResponse = await dispatch?.('POST', '/execute', executeInput);
    expect(serviceResponse?.statusCode).toBe(200);

    const expectedFixture = createFixtureRoot();
    const previous = process.cwd();
    process.chdir(expectedFixture);
    (globalThis as Record<string, unknown>)[TEST_ADAPTER_KEY] = createAdapter();
    const direct = await runSwarmExecution({
      swarmId: executeInput.swarmId,
      projectId: executeInput.projectId,
      executionMode: executeInput.mode,
      taskIntent: executeInput.intent
    });
    delete (globalThis as Record<string, unknown>)[TEST_ADAPTER_KEY];
    process.chdir(previous);
    fs.rmSync(expectedFixture, { recursive: true, force: true });

    expect(serviceResponse?.payload).toEqual(direct);

    const canonicalResult = canonicalStringify(serviceResponse?.payload);
    const expectedRunId = computeSwarmRunId(canonicalResult);
    const db = getServiceDb(TEST_DB_PATH);
    const journal = getJournalByRunId(db, expectedRunId);

    expect(journal).not.toBeNull();
    expect(journal?.type).toBe('swarm_execute');
    expect(journal?.ref_id).toBe('swarm/dev-team/run-1');
    expect(journal?.result_hash).toBe((serviceResponse?.payload as { deterministicHash: string }).deterministicHash);
  });

  it('POST /webhooks/test persists deterministic payment receipt and issuance intent', async () => {
    const payload = buildReceiptPayload();
    const response = await dispatch?.('POST', '/webhooks/test', payload);

    expect(response?.statusCode).toBe(200);
    expect(response?.payload).toMatchObject({
      ok: true,
      code: OK_RECEIPT_ACCEPTED
    });

    const canonicalPayload = canonicalStringify(payload);
    const eventId = computeEventId('test', canonicalPayload);
    const route = resolveHandlerRoute('test');
    expect(route).not.toBeNull();

    const taskId = computeTaskId(eventId, route?.handlerName ?? 'TestHandler', 0);
    const db = getServiceDb(TEST_DB_PATH);

    const eventRow = getEventById(db, eventId);
    const taskRow = getTaskById(db, taskId);

    expect(eventRow?.status).toBe('processed');
    expect(taskRow?.status).toBe('done');
    expect(countJournalByRefId(db, eventId)).toBe(1);

    const successPayload = response?.payload as {
      ok: true;
      code: string;
      receiptId: string;
      issuanceId: string;
      summaryCanonical: string;
    };

    const receiptRow = getReceiptById(db, successPayload.receiptId);
    const issuanceRow = getIssuanceById(db, successPayload.issuanceId);

    expect(receiptRow).not.toBeNull();
    expect(receiptRow?.subscription_id).toBe('sub_001');
    expect(receiptRow?.receipt_ref).toBe('rcpt_001');
    expect(receiptRow?.source_event_id).toBe(eventId);
    expect(receiptRow?.observed_at).toBe(FIXED_NOW);

    expect(issuanceRow).not.toBeNull();
    expect(issuanceRow?.subscription_id).toBe('sub_001');
    expect(issuanceRow?.receipt_id).toBe(successPayload.receiptId);
    expect(issuanceRow?.status).toBe('pending');
    expect(issuanceRow?.created_at).toBe(FIXED_NOW);

    expect(canonicalStringify(response?.payload)).toMatchInlineSnapshot(
      `"{"code":"OK_RECEIPT_ACCEPTED","issuanceId":"f5a0a8aecf397ad55f839ae1f6d543594144558007221f72b610fa4317f50344","ok":true,"receiptId":"d2d804656b222011a392d4c955a7280d4cc5994c2b382a2d17cae072276b7a90","summaryCanonical":"{\\"code\\":\\"OK_RECEIPT_ACCEPTED\\",\\"issuanceId\\":\\"f5a0a8aecf397ad55f839ae1f6d543594144558007221f72b610fa4317f50344\\",\\"ok\\":true,\\"receiptId\\":\\"d2d804656b222011a392d4c955a7280d4cc5994c2b382a2d17cae072276b7a90\\"}"}"`
    );
  });

  it('POST /webhooks/test rejects amount mismatch', async () => {
    const response = await dispatch?.('POST', '/webhooks/test', buildReceiptPayload({ amount: '1000.01' }));

    expect(response?.statusCode).toBe(200);
    expect(response?.payload).toEqual({
      ok: false,
      code: ERR_AMOUNT_MISMATCH,
      summaryCanonical: canonicalStringify({ ok: false, code: ERR_AMOUNT_MISMATCH })
    });
  });

  it('POST /webhooks/test rejects unauthorized payer', async () => {
    const response = await dispatch?.('POST', '/webhooks/test', buildReceiptPayload({ payerRef: '0xwallet_denied' }));

    expect(response?.statusCode).toBe(200);
    expect(response?.payload).toEqual({
      ok: false,
      code: ERR_PAYER_UNAUTHORIZED,
      summaryCanonical: canonicalStringify({ ok: false, code: ERR_PAYER_UNAUTHORIZED })
    });
  });

  it('POST /webhooks/test rejects duplicate receipt_ref', async () => {
    const first = await dispatch?.('POST', '/webhooks/test', buildReceiptPayload());
    expect(first?.payload).toMatchObject({ ok: true, code: OK_RECEIPT_ACCEPTED });

    const second = await dispatch?.('POST', '/webhooks/test', buildReceiptPayload({ subscriptionId: 'sub_002' }));
    expect(second?.statusCode).toBe(200);
    expect(second?.payload).toEqual({
      ok: false,
      code: ERR_DUPLICATE_RECEIPT,
      summaryCanonical: canonicalStringify({ ok: false, code: ERR_DUPLICATE_RECEIPT })
    });
  });

  it('POST /webhooks/test rejects second funding for same subscription', async () => {
    const first = await dispatch?.('POST', '/webhooks/test', buildReceiptPayload());
    expect(first?.payload).toMatchObject({ ok: true, code: OK_RECEIPT_ACCEPTED });

    const second = await dispatch?.('POST', '/webhooks/test', buildReceiptPayload({ receiptRef: 'rcpt_002' }));
    expect(second?.statusCode).toBe(200);
    expect(second?.payload).toEqual({
      ok: false,
      code: ERR_ALREADY_FUNDED,
      summaryCanonical: canonicalStringify({ ok: false, code: ERR_ALREADY_FUNDED })
    });
  });

  it('produces identical IDs for repeated identical logical webhook input', () => {
    const payloadA = { z: 1, a: { x: 2, y: 3 } };
    const payloadB = { a: { y: 3, x: 2 }, z: 1 };

    const canonicalA = canonicalStringify(payloadA);
    const canonicalB = canonicalStringify(payloadB);

    const eventIdA = computeEventId('test', canonicalA);
    const eventIdB = computeEventId('test', canonicalB);
    expect(eventIdA).toBe(eventIdB);

    const taskIdA = computeTaskId(eventIdA, 'TestHandler', 0);
    const taskIdB = computeTaskId(eventIdB, 'TestHandler', 0);
    expect(taskIdA).toBe(taskIdB);

    const canonicalResult = canonicalStringify({ ok: true, code: 'stub_ok', summaryCanonical: canonicalStringify({ event_id: eventIdA }) });
    const runIdA = sha256(`event_ingest\ntest\n${eventIdA}\n${canonicalResult}`);
    const runIdB = sha256(`event_ingest\ntest\n${eventIdB}\n${canonicalResult}`);
    expect(runIdA).toBe(runIdB);
  });
});
