import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../../finance/determinism.ts';
import { main as convertMain } from '../../../cli/mission-proposals-convert.ts';
import { main as historyMain } from '../../../cli/mission-proposals-history.ts';
import { main as inspectMain } from '../../../cli/mission-proposals-inspect.ts';
import { main as listMain } from '../../../cli/mission-proposals-list.ts';
import { main as materializeMain } from '../../../cli/mission-proposals-materialize.ts';
import { main as reviewMain } from '../../../cli/mission-proposals-review.ts';
import { main as statusMain } from '../../../cli/mission-proposals-status.ts';
import { main as submitMain } from '../../../cli/mission-proposals-submit.ts';

const {
  listProposals,
  inspectProposal,
  getProposalStatus,
  getProposalHistory,
  materializeProposal,
  submitProposal,
  submitProposalFromInput,
  reviewProposal,
  convertProposal,
} = vi.hoisted(() => ({
  listProposals: vi.fn(() => [{ proposalId: 'proposal-1', proposalType: 'market-memo-request' }]),
  inspectProposal: vi.fn(() => ({ proposalId: 'proposal-1', status: { proposalState: 'submitted' } })),
  getProposalStatus: vi.fn(() => ({ proposalId: 'proposal-1', proposalState: 'submitted' })),
  getProposalHistory: vi.fn(() => ({ proposalId: 'proposal-1', entries: [] })),
  materializeProposal: vi.fn(() => ({ proposalId: 'proposal-1', statusPath: 'a', reportPath: 'b', markdownPath: 'c', historyPath: 'd' })),
  submitProposal: vi.fn((value) => value),
  submitProposalFromInput: vi.fn((value) => ({ ...value, proposalId: 'proposal-1' })),
  reviewProposal: vi.fn(() => ({ proposalId: 'proposal-1', approvalState: 'approved' })),
  convertProposal: vi.fn(() => ({ proposalId: 'proposal-1', conversionState: 'mission_created', missionId: 'mission-1' })),
}));

vi.mock('../../../missions/proposals/mission-proposal-inspection.ts', () => ({
  createMissionProposalInspection: vi.fn(() => ({
    listProposals,
    inspectProposal,
    getProposalStatus,
    getProposalHistory,
    materializeProposal,
    submitProposal,
    submitProposalFromInput,
    reviewProposal,
    convertProposal,
  })),
}));

vi.mock('../../../missions/proposals/mission-proposal-registry.ts', () => ({
  createMissionProposalRegistry: vi.fn(() => ({
    getProposalDefinition: vi.fn(() => ({
      proposalType: 'market-memo-request',
      displayName: 'Market Memo Request',
      summary: 'summary',
      recommendedPriority: 'normal',
      defaultProposedMissionType: 'produce-market-memo',
      defaultProposedTemplateId: 'produce-market-memo',
    })),
  })),
}));

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-proposal-cli');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission proposals CLI commands', () => {
  it('T-MP-CLI1 list prints canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listProposals())}\n`);
    stdout.mockRestore();
  });

  it('T-MP-CLI2 inspect requires --proposal', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --proposal');
    stdout.mockRestore();
  });

  it('T-MP-CLI3 status routes --proposal', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await statusMain(['--proposal', 'proposal-1']);

    expect(code).toBe(0);
    expect(getProposalStatus).toHaveBeenCalledWith('proposal-1');
    stdout.mockRestore();
  });

  it('T-MP-CLI4 history routes --proposal', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain(['--proposal=proposal-1']);

    expect(code).toBe(0);
    expect(getProposalHistory).toHaveBeenCalledWith('proposal-1');
    stdout.mockRestore();
  });

  it('T-MP-CLI5 materialize routes --proposal', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await materializeMain(['--proposal', 'proposal-1']);

    expect(code).toBe(0);
    expect(materializeProposal).toHaveBeenCalledWith('proposal-1');
    stdout.mockRestore();
  });

  it('T-MP-CLI6 review routes decision args', async () => {
    fs.mkdirSync(tmpRoot, { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'reason.txt'), 'approved', 'utf8');
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await reviewMain([
      '--proposal', 'proposal-1',
      '--decision', 'approved',
      '--reviewed-by', 'founder-1',
      '--reason-file', path.join(tmpRoot, 'reason.txt'),
    ]);

    expect(code).toBe(0);
    expect(reviewProposal).toHaveBeenCalled();
    stdout.mockRestore();
  });

  it('T-MP-CLI7 convert routes proposal id', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await convertMain(['--proposal', 'proposal-1']);

    expect(code).toBe(0);
    expect(convertProposal).toHaveBeenCalledWith('proposal-1');
    stdout.mockRestore();
  });

  it('T-MP-CLI8 submit supports proposal file mode and stable errors', async () => {
    fs.mkdirSync(tmpRoot, { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'proposal.json'), JSON.stringify({
      proposalType: 'market-memo-request',
      displayName: 'Market Memo Request',
      summary: 'summary',
      objective: 'objective',
      rationale: 'rationale',
      proposedMissionType: 'produce-market-memo',
      proposedTemplateId: 'produce-market-memo',
      proposedParameters: { market_topic: 'rwa' },
      proposedFounderInstructions: '',
      requestedDeliverables: [],
      sourceReferences: [],
      linkedMissionIds: [],
      linkedDagIds: [],
      linkedActionPlanIds: [],
      linkedPortfolioIds: [],
      createdBy: { kind: 'agent', id: 'agent-1', displayName: 'Agent 1' },
      createdFrom: { kind: 'manual', id: 'manual-1' },
      approvalState: 'pending_review',
      proposalState: 'submitted',
      blockingReasons: [],
      limitations: [],
      recommendedPriority: 'normal',
      historyDigest: '',
    }), 'utf8');
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await submitMain(['--proposal-file', path.join(tmpRoot, 'proposal.json')]);

    expect(code).toBe(0);
    expect(submitProposalFromInput).toHaveBeenCalled();
    stdout.mockRestore();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });
});
