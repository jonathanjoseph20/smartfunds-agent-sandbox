import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as intentCreateMain } from '../../cli/commerce-intent-create.ts';
import { main as intentListMain } from '../../cli/commerce-intent-list.ts';
import { main as intentInspectMain } from '../../cli/commerce-intent-inspect.ts';
import { main as railsMain } from '../../cli/commerce-rails.ts';
import { main as eligibilityMain } from '../../cli/commerce-eligibility.ts';
import { main as receiptsMain } from '../../cli/commerce-receipts.ts';
import { main as settlementMain } from '../../cli/commerce-settlement.ts';
import { main as statusMain } from '../../cli/commerce-status.ts';
import { main as historyMain } from '../../cli/commerce-history.ts';
import { main as materializeMain } from '../../cli/commerce-materialize.ts';
import { main as recordReceiptMain } from '../../cli/commerce-receipt-record.ts';

const {
  createIntent,
  listChargeIntents,
  inspectChargeIntent,
  inspectRailBindings,
  inspectRailEligibility,
  inspectPaymentReceipts,
  inspectSettlementLogs,
  inspectCommerceStatus,
  inspectCommerceHistory,
  materializeCommerce,
  recordReceipt,
} = vi.hoisted(() => ({
  createIntent: vi.fn(() => ({ chargeIntentId: 'ci-1', buildEvidenceBundleId: 'be-1', runId: 'run-1', productSpecId: 'spec-1' })),
  listChargeIntents: vi.fn(() => ([{ chargeIntentId: 'ci-1', status: 'pending', outcome: 'pending_settlement' }])),
  inspectChargeIntent: vi.fn(() => ({ chargeIntentId: 'ci-1', status: 'pending' })),
  inspectRailBindings: vi.fn(() => ([{ railBindingId: 'rb-1' }])),
  inspectRailEligibility: vi.fn(() => ([{ railEligibilityId: 're-1' }])),
  inspectPaymentReceipts: vi.fn(() => ([{ paymentReceiptId: 'pr-1' }])),
  inspectSettlementLogs: vi.fn(() => ([{ settlementLogId: 'sl-1' }])),
  inspectCommerceStatus: vi.fn(() => ({ chargeIntentId: 'ci-1', status: 'pending' })),
  inspectCommerceHistory: vi.fn(() => ([{ eventType: 'charge_intent_created' }])),
  materializeCommerce: vi.fn(() => ({ chargeIntentId: 'ci-1', dirPath: 'artifacts/commerce/ci-1' })),
  recordReceipt: vi.fn(() => ({ paymentReceiptId: 'pr-manual-1' })),
}));

vi.mock('../../commerce/commerce-inspection.ts', () => ({
  createCommerceInspection: vi.fn(() => ({
    createIntent,
    listChargeIntents,
    inspectChargeIntent,
    inspectRailBindings,
    inspectRailEligibility,
    inspectPaymentReceipts,
    inspectSettlementLogs,
    inspectCommerceStatus,
    inspectCommerceHistory,
    materializeCommerce,
    recordReceipt,
  })),
}));

describe('commerce cli', () => {
  it('T-PF8-CLI1 required commands output canonical json', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await intentCreateMain(['--evidence', 'be-1'])).toBe(0);
    expect(await intentListMain([])).toBe(0);
    expect(await intentInspectMain(['--intent', 'ci-1'])).toBe(0);
    expect(await railsMain(['--intent', 'ci-1'])).toBe(0);
    expect(await eligibilityMain(['--intent', 'ci-1'])).toBe(0);
    expect(await receiptsMain(['--intent', 'ci-1'])).toBe(0);
    expect(await settlementMain(['--intent', 'ci-1'])).toBe(0);
    expect(await statusMain(['--intent', 'ci-1'])).toBe(0);
    expect(await historyMain(['--intent', 'ci-1'])).toBe(0);
    expect(await materializeMain(['--intent', 'ci-1'])).toBe(0);
    expect(await recordReceiptMain(['--intent', 'ci-1', '--rail-binding', 'rb-1', '--class', 'payment_received', '--reference', 'r-1'])).toBe(0);

    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(createIntent())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listChargeIntents())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectChargeIntent())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectRailBindings())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectRailEligibility())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectPaymentReceipts())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectSettlementLogs())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectCommerceStatus())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectCommerceHistory())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(materializeCommerce())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(recordReceipt())}\n`);

    stdout.mockRestore();
  });

  it('T-PF8-CLI2 missing and unknown args return stable errors', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await intentCreateMain([])).toBe(1);
    expect(await intentInspectMain([])).toBe(1);
    expect(await recordReceiptMain(['--intent', 'ci-1'])).toBe(1);
    expect(await intentListMain(['--bad'])).toBe(1);

    const output = stdout.mock.calls.map((entry) => String(entry[0])).join('');
    expect(output).toContain(canonicalStringify({ error: 'MISSING_ARGUMENT: --evidence' }));
    expect(output).toContain(canonicalStringify({ error: 'MISSING_ARGUMENT: --intent' }));
    expect(output).toContain(canonicalStringify({ error: 'MISSING_ARGUMENT: --rail-binding' }));
    expect(output).toContain(canonicalStringify({ error: 'UNKNOWN_ARGUMENT: --bad' }));

    stdout.mockRestore();
  });
});
