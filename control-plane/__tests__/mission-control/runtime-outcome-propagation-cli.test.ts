import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as listMain } from '../../cli/mission-control-propagation-list.ts';
import { main as inspectMain } from '../../cli/mission-control-propagation-inspect.ts';
import { main as activationMain } from '../../cli/mission-control-propagation-activation.ts';
import { main as coordinationMain } from '../../cli/mission-control-propagation-coordination.ts';
import { main as orchestrationMain } from '../../cli/mission-control-propagation-orchestration.ts';
import { main as portfolioMain } from '../../cli/mission-control-propagation-portfolio.ts';
import { main as statusMain } from '../../cli/mission-control-propagation-status.ts';
import { main as historyMain } from '../../cli/mission-control-propagation-history.ts';
import { main as materializeMain } from '../../cli/mission-control-propagation-materialize.ts';
import { main as deferMain } from '../../cli/mission-control-propagation-defer.ts';
import { main as markAppliedMain } from '../../cli/mission-control-propagation-mark-applied.ts';
import { main as markCompleteMain } from '../../cli/mission-control-propagation-mark-complete.ts';

const {
  listPropagationRecords,
  inspectPropagationRecord,
  inspectActivationPropagation,
  inspectCoordinationPropagation,
  inspectOrchestrationPropagation,
  inspectPortfolioPropagation,
  inspectPropagationHistory,
  inspectPropagationOutcome,
  materializePropagationRecord,
  deferPropagationRecord,
  markPropagationApplied,
  markPropagationComplete,
} = vi.hoisted(() => ({
  listPropagationRecords: vi.fn(() => [{ runtimeOutcomePropagationRecordId: 'record-1' }]),
  inspectPropagationRecord: vi.fn(() => ({ runtimeOutcomePropagationRecordId: 'record-1', status: 'applied' })),
  inspectActivationPropagation: vi.fn(() => []),
  inspectCoordinationPropagation: vi.fn(() => []),
  inspectOrchestrationPropagation: vi.fn(() => []),
  inspectPortfolioPropagation: vi.fn(() => []),
  inspectPropagationHistory: vi.fn(() => ({ runtimeOutcomePropagationRecordId: 'record-1', entries: [] })),
  inspectPropagationOutcome: vi.fn(() => ({ runtimeOutcomePropagationRecordId: 'record-1', status: 'applied', outcome: 'upstream_updated' })),
  materializePropagationRecord: vi.fn(() => ({ runtimeOutcomePropagationRecordId: 'record-1' })),
  deferPropagationRecord: vi.fn(() => ({ statusPreview: { runtimeOutcomePropagationRecordId: 'record-1', status: 'deferred' } })),
  markPropagationApplied: vi.fn(() => ({ statusPreview: { runtimeOutcomePropagationRecordId: 'record-1', status: 'applied' } })),
  markPropagationComplete: vi.fn(() => ({ statusPreview: { runtimeOutcomePropagationRecordId: 'record-1', status: 'applied' } })),
}));

vi.mock('../../mission-control/runtime-outcome-propagation-inspection.ts', () => ({
  createRuntimeOutcomePropagationInspection: vi.fn(() => ({
    listPropagationRecords,
    inspectPropagationRecord,
    inspectActivationPropagation,
    inspectCoordinationPropagation,
    inspectOrchestrationPropagation,
    inspectPortfolioPropagation,
    inspectPropagationHistory,
    inspectPropagationOutcome,
  })),
}));

vi.mock('../../mission-control/runtime-outcome-propagation-manager.ts', () => ({
  createRuntimeOutcomePropagationManager: vi.fn(() => ({
    materializePropagationRecord,
    deferPropagationRecord,
    markPropagationApplied,
    markPropagationComplete,
  })),
}));

describe('runtime outcome propagation cli', () => {
  it('T-ROP-CLI1 command routing is deterministic', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await listMain([]);
    await inspectMain(['--record', 'record-1']);
    await activationMain(['--record=record-1']);
    await coordinationMain(['--record=record-1']);
    await orchestrationMain(['--record=record-1']);
    await portfolioMain(['--record=record-1']);
    await statusMain(['--record=record-1']);
    await historyMain(['--record=record-1']);
    await materializeMain(['--record=record-1']);
    await deferMain(['--record=record-1']);
    await markAppliedMain(['--record=record-1']);
    await markCompleteMain(['--record=record-1']);

    expect(listPropagationRecords).toHaveBeenCalled();
    expect(inspectPropagationRecord).toHaveBeenCalledWith({ runtimeOutcomePropagationRecordId: 'record-1' });
    expect(materializePropagationRecord).toHaveBeenCalledWith({ runtimeOutcomePropagationRecordId: 'record-1' });

    stdout.mockRestore();
  });

  it('T-ROP-CLI2 parse failures return stable JSON errors', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'MISSING_ARGUMENT: --record' })}\n`);

    stdout.mockRestore();
  });
});
