import { describe, expect, it } from 'vitest';

import { validateMissionTemplateDefinition } from './mission-template-validator.ts';

function validTemplate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    missionId: 'tokenization-legal-analysis',
    title: 'Tokenization Compliance Review',
    missionType: 'legal-analysis',
    projectId: 'smartfunds-core',
    workflowId: 'research-analysis-workflow',
    objectives: ['determine if Reg D exemption applies'],
    successCriteria: ['regulatory citations present'],
    deliverables: ['legal-memo.md'],
    artifacts: [{ name: 'legal-memo.md', type: 'document' }],
    teamId: 'smartfunds-legal',
    workflow: ['planning', 'research', 'verification', 'delivery'],
    ...overrides
  };
}

describe('mission-template-validator', () => {
  it('T-S77-MV1 rejects no objectives', () => {
    expect(() => validateMissionTemplateDefinition(validTemplate({ objectives: [] }))).toThrow(/objectives/);
  });

  it('T-S77-MV2 rejects no successCriteria', () => {
    expect(() => validateMissionTemplateDefinition(validTemplate({ successCriteria: [] }))).toThrow(/successCriteria/);
  });

  it('T-S77-MV3 rejects no deliverables', () => {
    expect(() => validateMissionTemplateDefinition(validTemplate({ deliverables: [] }))).toThrow(/deliverables/);
  });

  it('T-S77-MV4 rejects no artifacts', () => {
    expect(() => validateMissionTemplateDefinition(validTemplate({ artifacts: [] }))).toThrow(/artifacts/);
  });

  it('T-S77-MV5 rejects no teamId', () => {
    expect(() => validateMissionTemplateDefinition(validTemplate({ teamId: '' }))).toThrow(/teamId/);
  });

  it('T-S77-MV6 rejects artifact definitions mismatch deliverables', () => {
    expect(() => validateMissionTemplateDefinition(validTemplate({
      deliverables: ['legal-memo.md', 'risk-analysis.md'],
      artifacts: [{ name: 'legal-memo.md', type: 'document' }]
    }))).toThrow(/mismatch deliverables/);
  });
});
