import { describe, expect, it } from 'vitest';

import { validateMissionDefinition } from './mission-validator.ts';

function validMission(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    missionId: 'rwa-market-analysis',
    name: 'RWA Market Opportunity Analysis',
    projectId: 'smartfunds-core',
    teamId: 'smartfunds-research-team',
    workflowId: 'research-analysis-workflow',
    objective: 'Analyze near-term tokenized RWA opportunities.',
    successCriteria: ['Produce market landscape summary'],
    deliverables: ['market-summary'],
    initialContext: {
      sector: 'RWA'
    },
    ...overrides
  };
}

describe('mission-validator', () => {
  it('T-M1 validates mission contract', () => {
    const mission = validateMissionDefinition(validMission());

    expect(mission.missionId).toBe('rwa-market-analysis');
    expect(mission.workflowId).toBe('research-analysis-workflow');
  });

  it('T-M2 rejects missing teamId', () => {
    expect(() => validateMissionDefinition(validMission({ teamId: '' }))).toThrow(/teamId must be a non-empty string/);
  });

  it('T-M3 rejects missing workflowId', () => {
    expect(() => validateMissionDefinition(validMission({ workflowId: '' }))).toThrow(
      /workflowId must be a non-empty string/
    );
  });
});
