import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main as inspectMain } from './mission-templates-inspect.ts';
import { main as instantiateMain } from './mission-templates-instantiate.ts';
import { main as listMain } from './mission-templates-list.ts';

const {
  listMissionTemplates,
  getMissionTemplate,
  instantiateMissionTemplate,
} = vi.hoisted(() => ({
  listMissionTemplates: vi.fn(() => [
    {
      templateId: 'evaluate-startup-opportunity',
      displayName: 'Evaluate Startup Opportunity',
      description: 'Evaluate whether a development creates a scalable venture opportunity.',
    },
  ]),
  getMissionTemplate: vi.fn(() => ({
    templateId: 'evaluate-startup-opportunity',
    missionType: 'evaluate-startup-opportunity',
    displayName: 'Evaluate Startup Opportunity',
    description: 'Evaluate whether a development creates a scalable venture opportunity.',
    parameters: {
      sector: { type: 'string', required: true },
    },
    defaultObjectiveTemplate: 'Evaluate {{sector}}',
    defaultDeliverablesTemplate: ['executive-summary'],
    allowedSourceKinds: ['market-intelligence'],
  })),
  instantiateMissionTemplate: vi.fn(() => ({
    missionId: 'mission-1',
    missionIdentityPayload: {
      missionType: 'evaluate-startup-opportunity',
      objective: 'Evaluate AI',
      requestedDeliverables: [{ deliverableId: 'executive-summary' }],
      sourceReferences: [],
      linkedActionPlanIds: [],
      founderInstructions: '',
      createdFrom: { kind: 'template' },
    },
    missionInstance: {
      missionId: 'mission-1',
      missionType: 'evaluate-startup-opportunity',
      displayName: 'Evaluate Startup Opportunity',
      objective: 'Evaluate AI',
      founderInstructions: '',
      requestedDeliverables: [{ deliverableId: 'executive-summary' }],
      sourceReferences: [],
      linkedActionPlanIds: [],
      linkedPortfolioIds: [],
      linkedMarketSynthesisIds: [],
      recommendedTeamIds: [],
      assignedTeamIds: [],
      approvalState: 'pending_review',
      lifecycleState: 'draft',
      readinessState: 'pending',
      completionState: 'not_started',
      blockingReasons: [],
      limitations: [],
      createdFrom: { kind: 'template', referenceId: 'evaluate-startup-opportunity' },
      historyDigest: '',
    },
    parameters: {
      sector: 'AI',
    },
  })),
}));

const readFileSync = vi.hoisted(() => vi.fn());

vi.mock('../missions/templates/mission-template-registry.ts', () => ({
  listMissionTemplates,
  getMissionTemplate,
}));

vi.mock('../missions/templates/mission-template-engine.ts', () => ({
  instantiateMissionTemplate,
}));

vi.mock('node:fs', () => ({
  default: {
    readFileSync,
  },
}));

describe('mission templates CLI', () => {
  it('T-MTPL-CLI1 mission-templates:list outputs canonical summaries', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listMissionTemplates())}\n`);
    stdout.mockRestore();
  });

  it('T-MTPL-CLI2 mission-templates:inspect requires --template', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --template');
    stdout.mockRestore();
  });

  it('T-MTPL-CLI3 mission-templates:instantiate routes parsed args', async () => {
    readFileSync.mockReturnValueOnce(JSON.stringify({ sector: 'AI' }));
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await instantiateMain([
      '--template',
      'evaluate-startup-opportunity',
      '--params-file',
      'tmp.json',
      '--founder-instructions',
      'Focus on moats',
    ]);

    expect(code).toBe(0);
    expect(instantiateMissionTemplate).toHaveBeenCalledWith(
      'evaluate-startup-opportunity',
      { sector: 'AI' },
      'Focus on moats',
    );
    const expected = {
  ...instantiateMissionTemplate(),
  persisted: false
};

expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(expected)}\n`);
    stdout.mockRestore();
  });

  it('T-MTPL-CLI4 mission-templates:instantiate rejects non-object params file', async () => {
    readFileSync.mockReturnValueOnce(JSON.stringify(['bad']));
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await instantiateMain([
      '--template',
      'evaluate-startup-opportunity',
      '--params-file',
      'tmp.json',
    ]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('Invalid params file: expected JSON object');
    stdout.mockRestore();
  });
});
