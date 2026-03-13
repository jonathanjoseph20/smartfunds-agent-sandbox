import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as listMain } from '../../cli/mission-control-activation-list.ts';
import { main as inspectMain } from '../../cli/mission-control-activation-inspect.ts';
import { main as mappingsMain } from '../../cli/mission-control-activation-mappings.ts';
import { main as eligibilityMain } from '../../cli/mission-control-activation-eligibility.ts';
import { main as queueMain } from '../../cli/mission-control-activation-queue.ts';
import { main as feedbackMain } from '../../cli/mission-control-activation-feedback.ts';
import { main as statusMain } from '../../cli/mission-control-activation-status.ts';
import { main as historyMain } from '../../cli/mission-control-activation-history.ts';
import { main as materializeMain } from '../../cli/mission-control-activation-materialize.ts';
import { main as deferMain } from '../../cli/mission-control-activation-defer.ts';
import { main as markSubmittedMain } from '../../cli/mission-control-activation-mark-submitted.ts';
import { main as markCompleteMain } from '../../cli/mission-control-activation-mark-complete.ts';

const {
  listActivationRecords,
  inspectActivationRecord,
  inspectRequestActivationMappings,
  inspectActivationEligibility,
  inspectActivationQueue,
  inspectActivationFeedbackLinks,
  inspectActivationStatus,
  inspectActivationHistory,
  materializeExecutionActivationRecord,
  deferExecutionActivationRecord,
  markExecutionActivationSubmitted,
  markExecutionActivationComplete,
} = vi.hoisted(() => ({
  listActivationRecords: vi.fn(() => [{ executionActivationRecordId: 'activation-1', queueState: 'queued', priority: 'high' }]),
  inspectActivationRecord: vi.fn(() => ({ executionActivationRecordId: 'activation-1' })),
  inspectRequestActivationMappings: vi.fn(() => ({ executionActivationRecordId: 'activation-1' })),
  inspectActivationEligibility: vi.fn(() => ({ executionActivationRecordId: 'activation-1', eligibilityStatus: 'eligible' })),
  inspectActivationQueue: vi.fn(() => ({ executionActivationRecordId: 'activation-1', queueState: 'queued' })),
  inspectActivationFeedbackLinks: vi.fn(() => []),
  inspectActivationStatus: vi.fn(() => ({ executionActivationRecordId: 'activation-1', status: 'pending_activation' })),
  inspectActivationHistory: vi.fn(() => ({ executionActivationRecordId: 'activation-1', entries: [] })),
  materializeExecutionActivationRecord: vi.fn(() => ({ executionActivationRecordId: 'activation-1' })),
  deferExecutionActivationRecord: vi.fn(() => ({ statusPreview: { executionActivationRecordId: 'activation-1', status: 'activation_deferred' } })),
  markExecutionActivationSubmitted: vi.fn(() => ({ statusPreview: { executionActivationRecordId: 'activation-1', status: 'handoff_submitted' } })),
  markExecutionActivationComplete: vi.fn(() => ({ statusPreview: { executionActivationRecordId: 'activation-1', status: 'activation_completed' } })),
}));

vi.mock('../../mission-control/mission-execution-activation-inspection.ts', () => ({
  createMissionExecutionActivationInspection: vi.fn(() => ({
    listActivationRecords,
    inspectActivationRecord,
    inspectRequestActivationMappings,
    inspectActivationEligibility,
    inspectActivationQueue,
    inspectActivationFeedbackLinks,
    inspectActivationStatus,
    inspectActivationHistory,
  })),
}));

vi.mock('../../mission-control/mission-execution-activation-manager.ts', () => ({
  createMissionExecutionActivationManager: vi.fn(() => ({
    materializeExecutionActivationRecord,
    deferExecutionActivationRecord,
    markExecutionActivationSubmitted,
    markExecutionActivationComplete,
  })),
}));

describe('mission execution activation cli', () => {
  it('T-MEA-CLI1 command routing is deterministic', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await listMain([]);
    await inspectMain(['--activation', 'activation-1']);
    await mappingsMain(['--activation=activation-1']);
    await eligibilityMain(['--activation=activation-1']);
    await queueMain(['--activation=activation-1']);
    await feedbackMain(['--activation=activation-1']);
    await statusMain(['--activation=activation-1']);
    await historyMain(['--activation=activation-1']);
    await materializeMain(['--activation=activation-1']);
    await deferMain(['--activation=activation-1']);
    await markSubmittedMain(['--activation=activation-1']);
    await markCompleteMain(['--activation=activation-1']);

    expect(listActivationRecords).toHaveBeenCalled();
    expect(inspectActivationRecord).toHaveBeenCalledWith({ executionActivationRecordId: 'activation-1' });
    expect(materializeExecutionActivationRecord).toHaveBeenCalledWith({ executionActivationRecordId: 'activation-1' });

    stdout.mockRestore();
  });

  it('T-MEA-CLI2 parse failures return stable JSON errors', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'MISSING_ARGUMENT: --activation' })}\n`);

    stdout.mockRestore();
  });
});
