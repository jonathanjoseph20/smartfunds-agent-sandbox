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
    expect(mission.profile).toBeUndefined();
    expect(mission.requestedCapabilities).toBeUndefined();
  });

  it('T-M2 rejects missing teamId', () => {
    expect(() => validateMissionDefinition(validMission({ teamId: '' }))).toThrow(/teamId must be a non-empty string/);
  });

  it('T-M3 rejects missing workflowId', () => {
    expect(() => validateMissionDefinition(validMission({ workflowId: '' }))).toThrow(
      /workflowId must be a non-empty string/
    );
  });

  it('T-M10 validates optional parameter schema with deterministic ordering', () => {
    const mission = validateMissionDefinition(validMission({
      parameterSchema: {
        allowed: ['risk-level', 'market'],
        required: ['market'],
        defaults: {
          'risk-level': 'medium'
        }
      }
    }));

    expect(mission.parameterSchema).toEqual({
      allowed: ['market', 'risk-level'],
      required: ['market'],
      defaults: {
        'risk-level': 'medium'
      }
    });
  });

  it('T-M11 preserves compatibility when policy profile fields are absent', () => {
    const mission = validateMissionDefinition(validMission());

    expect(mission).toMatchObject({
      missionId: 'rwa-market-analysis',
      workflowId: 'research-analysis-workflow'
    });
    expect(mission.profile).toBeUndefined();
    expect(mission.mutationIntent).toBeUndefined();
    expect(mission.targetScope).toBeUndefined();
  });

  it('T-M12 validates policy profile fields with deterministic ordering', () => {
    const mission = validateMissionDefinition(validMission({
      profile: 'build',
      mutationIntent: 'code_change',
      requestedCapabilities: ['repo_write', 'read', 'read', 'artifact_write'],
      targetScope: {
        repo: 'smartfunds-agent-sandbox',
        paths: ['tools/**', 'apps/**', 'apps/**']
      }
    }));

    expect(mission.profile).toBe('build');
    expect(mission.mutationIntent).toBe('code_change');
    expect(mission.requestedCapabilities).toEqual(['artifact_write', 'read', 'repo_write']);
    expect(mission.targetScope).toEqual({
      repo: 'smartfunds-agent-sandbox',
      paths: ['apps/**', 'tools/**']
    });
  });

  it('T-SPC-M13 accepts build-specific mutation intents', () => {
    const mission = validateMissionDefinition(validMission({
      profile: 'build',
      mutationIntent: 'ui_change',
      requestedCapabilities: ['artifact_write', 'pr_open', 'read', 'repo_write'],
      targetScope: {
        repo: 'smartfunds-agent-sandbox',
        paths: ['dashboard/**']
      }
    }));

    expect(mission.mutationIntent).toBe('ui_change');
  });
});
