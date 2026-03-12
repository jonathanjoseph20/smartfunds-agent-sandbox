import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as evaluateMain } from '../../cli/execution-journal-evaluate.ts';
import { main as historyMain } from '../../cli/execution-journal-history.ts';
import { main as inspectMain } from '../../cli/execution-journal-inspect.ts';
import { main as listMain } from '../../cli/execution-journal-list.ts';
import { main as materializeMain } from '../../cli/execution-journal-materialize.ts';
import { main as statusMain } from '../../cli/execution-journal-status.ts';

const {
  listExecutionJournals,
  inspectExecutionJournal,
  getExecutionJournalStatus,
  getExecutionJournalHistory,
  materializeExecutionJournal,
  evaluateExecutionJournal,
} = vi.hoisted(() => ({
  listExecutionJournals: vi.fn(() => [{ executionJournalId: 'ej-1', executionAttemptId: 'ea-1' }]),
  inspectExecutionJournal: vi.fn(() => ({ executionJournalId: 'ej-1', executionAttemptId: 'ea-1' })),
  getExecutionJournalStatus: vi.fn(() => ({ executionJournalId: 'ej-1', journalState: 'collecting' })),
  getExecutionJournalHistory: vi.fn(() => ({ executionJournalId: 'ej-1', events: [] })),
  materializeExecutionJournal: vi.fn(() => ({ executionJournalId: 'ej-1' })),
  evaluateExecutionJournal: vi.fn(() => ({ executionJournalId: 'ej-1' })),
}));

vi.mock('../../execution-journal/execution-journal-inspection.ts', () => ({
  createExecutionJournalInspection: vi.fn(() => ({
    listExecutionJournals,
    inspectExecutionJournal,
    getExecutionJournalStatus,
    getExecutionJournalHistory,
    materializeExecutionJournal,
    evaluateExecutionJournal,
  })),
}));

describe('execution journal CLI commands', () => {
  it('T-MEJ-CLI1 list prints canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listExecutionJournals())}\n`);
    stdout.mockRestore();
  });

  it('T-MEJ-CLI2 inspect requires --attempt', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --attempt');
    stdout.mockRestore();
  });

  it('T-MEJ-CLI3 status routes attempt argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await statusMain(['--attempt', 'ea-1']);

    expect(code).toBe(0);
    expect(getExecutionJournalStatus).toHaveBeenCalledWith({ executionAttemptId: 'ea-1' });
    stdout.mockRestore();
  });

  it('T-MEJ-CLI4 history routes attempt argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain(['--attempt=ea-1']);

    expect(code).toBe(0);
    expect(getExecutionJournalHistory).toHaveBeenCalledWith({ executionAttemptId: 'ea-1' });
    stdout.mockRestore();
  });

  it('T-MEJ-CLI5 evaluate and materialize route attempt argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const evaluateCode = await evaluateMain(['--attempt', 'ea-1']);
    const materializeCode = await materializeMain(['--attempt', 'ea-1']);

    expect(evaluateCode).toBe(0);
    expect(materializeCode).toBe(0);
    expect(evaluateExecutionJournal).toHaveBeenCalledWith({ executionAttemptId: 'ea-1' });
    expect(materializeExecutionJournal).toHaveBeenCalledWith({ executionAttemptId: 'ea-1' });
    stdout.mockRestore();
  });

  it('T-MEJ-CLI6 stable error payload shape is preserved', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    inspectExecutionJournal.mockImplementationOnce(() => {
      throw new Error('EXECUTION_ATTEMPT_NOT_FOUND');
    });

    const code = await inspectMain(['--attempt', 'missing']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'EXECUTION_ATTEMPT_NOT_FOUND' })}\n`);
    stdout.mockRestore();
  });
});
