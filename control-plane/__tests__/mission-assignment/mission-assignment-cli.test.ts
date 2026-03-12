import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as confirmMain } from '../../cli/mission-assignment-confirm.ts';
import { main as evaluateMain } from '../../cli/mission-assignment-evaluate.ts';
import { main as historyMain } from '../../cli/mission-assignment-history.ts';
import { main as inspectMain } from '../../cli/mission-assignment-inspect.ts';
import { main as listMain } from '../../cli/mission-assignment-list.ts';
import { main as materializeMain } from '../../cli/mission-assignment-materialize.ts';
import { main as overrideMain } from '../../cli/mission-assignment-override.ts';
import { main as statusMain } from '../../cli/mission-assignment-status.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-assignment-cli');

const {
  listAssignments,
  inspectAssignment,
  getAssignmentStatus,
  getAssignmentHistory,
  materializeAssignment,
  evaluateAssignment,
  confirmAssignment,
  overrideAssignment,
} = vi.hoisted(() => ({
  listAssignments: vi.fn(() => [{ assignmentDecisionId: 'd1', missionId: 'm1', decisionState: 'under_review' }]),
  inspectAssignment: vi.fn(() => ({ missionId: 'm1', assignmentDecisionId: 'd1' })),
  getAssignmentStatus: vi.fn(() => ({ missionId: 'm1', decisionState: 'under_review' })),
  getAssignmentHistory: vi.fn(() => ({ assignmentDecisionId: 'd1', missionId: 'm1', entries: [] })),
  materializeAssignment: vi.fn(() => ({ assignmentDecisionId: 'd1', missionId: 'm1' })),
  evaluateAssignment: vi.fn(() => ({ assignmentDecisionId: 'd1', missionId: 'm1' })),
  confirmAssignment: vi.fn(() => ({ assignmentDecisionId: 'd1', missionId: 'm1', decisionState: 'confirmed' })),
  overrideAssignment: vi.fn(() => ({ assignmentDecisionId: 'd2', missionId: 'm1', assignmentMode: 'founder_override' })),
}));

vi.mock('../../mission-assignment/mission-assignment-inspection.ts', () => ({
  createMissionAssignmentInspection: vi.fn(() => ({
    listAssignments,
    inspectAssignment,
    getAssignmentStatus,
    getAssignmentHistory,
    materializeAssignment,
    evaluateAssignment,
    confirmAssignment,
    overrideAssignment,
  })),
}));

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission assignment CLI commands', () => {
  it('T-MA-CLI1 list prints canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listAssignments())}\n`);
    stdout.mockRestore();
  });

  it('T-MA-CLI2 inspect requires --mission', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --mission');
    stdout.mockRestore();
  });

  it('T-MA-CLI3 status routes mission argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await statusMain(['--mission', 'm1']);

    expect(code).toBe(0);
    expect(getAssignmentStatus).toHaveBeenCalledWith({ missionId: 'm1' });
    stdout.mockRestore();
  });

  it('T-MA-CLI4 history routes mission argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain(['--mission=m1']);

    expect(code).toBe(0);
    expect(getAssignmentHistory).toHaveBeenCalledWith({ missionId: 'm1' });
    stdout.mockRestore();
  });

  it('T-MA-CLI5 evaluate and confirm route mission argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const evalCode = await evaluateMain(['--mission', 'm1']);
    const confirmCode = await confirmMain(['--mission', 'm1']);

    expect(evalCode).toBe(0);
    expect(confirmCode).toBe(0);
    expect(evaluateAssignment).toHaveBeenCalledWith({ missionId: 'm1' });
    expect(confirmAssignment).toHaveBeenCalledWith({ missionId: 'm1' });
    stdout.mockRestore();
  });

  it('T-MA-CLI6 materialize routes mission argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await materializeMain(['--mission', 'm1']);

    expect(code).toBe(0);
    expect(materializeAssignment).toHaveBeenCalledWith({ missionId: 'm1' });
    stdout.mockRestore();
  });

  it('T-MA-CLI7 override reads reason file and routes full payload', async () => {
    fs.mkdirSync(tmpRoot, { recursive: true });
    const reasonFile = path.join(tmpRoot, 'reason.txt');
    fs.writeFileSync(reasonFile, 'override rationale\n', 'utf8');

    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await overrideMain([
      '--mission',
      'm1',
      '--team',
      'team-2',
      '--reason-file',
      reasonFile,
      '--reviewed-by',
      'founder',
    ]);

    expect(code).toBe(0);
    expect(overrideAssignment).toHaveBeenCalledWith({
      missionId: 'm1',
      selectedTeamId: 'team-2',
      reason: 'override rationale',
      reviewedBy: 'founder',
    });
    stdout.mockRestore();
  });

  it('T-MA-CLI8 stable error payload shape is preserved', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    inspectAssignment.mockImplementationOnce(() => {
      throw new Error('MISSION_NOT_FOUND: missing');
    });

    const code = await inspectMain(['--mission', 'missing']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'MISSION_NOT_FOUND: missing' })}\n`);
    stdout.mockRestore();
  });
});
