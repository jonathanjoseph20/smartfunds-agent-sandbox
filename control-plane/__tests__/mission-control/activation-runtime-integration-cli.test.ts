import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as listMain } from '../../cli/mission-control-runtime-dispatch-list.ts';
import { main as inspectMain } from '../../cli/mission-control-runtime-dispatch-inspect.ts';
import { main as queueMain } from '../../cli/mission-control-runtime-dispatch-queue.ts';
import { main as linksMain } from '../../cli/mission-control-runtime-links.ts';
import { main as feedbackMain } from '../../cli/mission-control-runtime-feedback.ts';
import { main as reconciliationMain } from '../../cli/mission-control-runtime-reconciliation.ts';
import { main as statusMain } from '../../cli/mission-control-runtime-status.ts';
import { main as historyMain } from '../../cli/mission-control-runtime-history.ts';
import { main as materializeMain } from '../../cli/mission-control-runtime-materialize.ts';
import { main as deferMain } from '../../cli/mission-control-runtime-defer.ts';
import { main as markSubmittedMain } from '../../cli/mission-control-runtime-mark-submitted.ts';
import { main as markCompleteMain } from '../../cli/mission-control-runtime-mark-complete.ts';

const {
  listDispatchAttempts,
  inspectDispatchAttempt,
  inspectDispatchQueue,
  inspectRuntimeLinks,
  inspectFeedbackRecords,
  inspectReconciliation,
  inspectIntegrationHistory,
  materializeDispatchAttempt,
  deferDispatchAttempt,
  markDispatchSubmitted,
  markDispatchComplete,
} = vi.hoisted(() => ({
  listDispatchAttempts: vi.fn(() => [{ activationDispatchAttemptId: 'attempt-1', dispatchQueueState: 'queued', priority: 'high' }]),
  inspectDispatchAttempt: vi.fn(() => ({ activationDispatchAttemptId: 'attempt-1', status: { status: 'pending_dispatch' } })),
  inspectDispatchQueue: vi.fn(() => ({ activationDispatchAttemptId: 'attempt-1', queueState: 'queued' })),
  inspectRuntimeLinks: vi.fn(() => []),
  inspectFeedbackRecords: vi.fn(() => []),
  inspectReconciliation: vi.fn(() => []),
  inspectIntegrationHistory: vi.fn(() => ({ activationDispatchAttemptId: 'attempt-1', entries: [] })),
  materializeDispatchAttempt: vi.fn(() => ({ activationDispatchAttemptId: 'attempt-1' })),
  deferDispatchAttempt: vi.fn(() => ({ statusPreview: { activationDispatchAttemptId: 'attempt-1', status: 'runtime_deferred' } })),
  markDispatchSubmitted: vi.fn(() => ({ statusPreview: { activationDispatchAttemptId: 'attempt-1', status: 'dispatch_submitted' } })),
  markDispatchComplete: vi.fn(() => ({ statusPreview: { activationDispatchAttemptId: 'attempt-1', status: 'runtime_completed' } })),
}));

vi.mock('../../mission-control/activation-runtime-integration-inspection.ts', () => ({
  createActivationRuntimeIntegrationInspection: vi.fn(() => ({
    listDispatchAttempts,
    inspectDispatchAttempt,
    inspectDispatchQueue,
    inspectRuntimeLinks,
    inspectFeedbackRecords,
    inspectReconciliation,
    inspectIntegrationHistory,
  })),
}));

vi.mock('../../mission-control/activation-runtime-integration-manager.ts', () => ({
  createActivationRuntimeIntegrationManager: vi.fn(() => ({
    materializeDispatchAttempt,
    deferDispatchAttempt,
    markDispatchSubmitted,
    markDispatchComplete,
  })),
}));

describe('activation runtime integration cli', () => {
  it('T-ARI-CLI1 command routing is deterministic', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await listMain([]);
    await inspectMain(['--attempt', 'attempt-1']);
    await queueMain(['--attempt=attempt-1']);
    await linksMain(['--attempt=attempt-1']);
    await feedbackMain(['--attempt=attempt-1']);
    await reconciliationMain(['--attempt=attempt-1']);
    await statusMain(['--attempt=attempt-1']);
    await historyMain(['--attempt=attempt-1']);
    await materializeMain(['--attempt=attempt-1']);
    await deferMain(['--attempt=attempt-1']);
    await markSubmittedMain(['--attempt=attempt-1']);
    await markCompleteMain(['--attempt=attempt-1']);

    expect(listDispatchAttempts).toHaveBeenCalled();
    expect(inspectDispatchAttempt).toHaveBeenCalledWith({ activationDispatchAttemptId: 'attempt-1' });
    expect(materializeDispatchAttempt).toHaveBeenCalledWith({ activationDispatchAttemptId: 'attempt-1' });

    stdout.mockRestore();
  });

  it('T-ARI-CLI2 parse failures return stable JSON errors', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'MISSING_ARGUMENT: --attempt' })}\n`);

    stdout.mockRestore();
  });
});
