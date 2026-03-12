import { describe, expect, it } from 'vitest';

import { createTeamCompatibilityEvaluator } from '../../team-compatibility/team-compatibility-evaluator.ts';

function createEvaluator() {
  const missionProjection = {
    projectOne: (missionId: string) => ({
      missionId,
      missionType: 'generate-product-spec',
      definition: { tags: ['product', 'specification'] },
      instance: {
        requestedDeliverables: [{ deliverableId: 'product_spec' }, { deliverableId: 'mvp_scope' }],
      },
    }),
    projectAll: () => ([
      {
        missionId: 'mission-1',
      },
    ]),
  };

  const teamProjection = {
    projectAll: () => ([
      {
        teamId: 'team-strong',
        definition: {
          supportedMissionTypes: ['generate-product-spec'],
          supportedTemplateIds: ['generate-product-spec'],
          domainTags: ['product'],
          capabilityTags: ['product_spec', 'mvp_scope'],
        },
        status: {
          lifecycleState: 'active',
          availabilityState: 'available',
          readinessState: 'ready',
        },
      },
      {
        teamId: 'team-manual',
        definition: {
          supportedMissionTypes: ['generate-product-spec'],
          supportedTemplateIds: ['generate-product-spec'],
          domainTags: ['product'],
          capabilityTags: ['mvp_scope'],
        },
        status: {
          lifecycleState: 'active',
          availabilityState: 'manual_only',
          readinessState: 'ready',
        },
      },
      {
        teamId: 'team-unsupported',
        definition: {
          supportedMissionTypes: ['produce-market-memo'],
          supportedTemplateIds: ['produce-market-memo'],
          domainTags: ['market'],
          capabilityTags: ['memo'],
        },
        status: {
          lifecycleState: 'active',
          availabilityState: 'available',
          readinessState: 'ready',
        },
      },
      {
        teamId: 'team-inconclusive',
        definition: {
          supportedMissionTypes: ['generate-product-spec'],
          supportedTemplateIds: ['generate-product-spec'],
          domainTags: ['product'],
          capabilityTags: ['product_spec'],
        },
        status: {
          lifecycleState: 'active',
          availabilityState: 'available',
          readinessState: 'inconclusive',
        },
      },
    ]),
  };

  return createTeamCompatibilityEvaluator({
    missionProjection: missionProjection as never,
    teamProjection: teamProjection as never,
  });
}

describe('team compatibility evaluator', () => {
  it('T-TC-E1 computes strong/manual/unsupported/inconclusive classes deterministically', () => {
    const evaluator = createEvaluator();
    const result = evaluator.evaluateMissionCompatibility('mission-1').compatibilitySet;

    const strong = result.candidateTeams.find((entry) => entry.teamId === 'team-strong');
    expect(strong?.compatibilityClass).toBe('strong_match');
    expect(strong?.assignmentReadiness).toBe('ready');

    const manual = result.candidateTeams.find((entry) => entry.teamId === 'team-manual');
    expect(manual?.assignmentReadiness).toBe('manual_review_required');
    expect(manual?.limitations).toContain('availability_manual_only');

    const unsupported = result.candidateTeams.find((entry) => entry.teamId === 'team-unsupported');
    expect(unsupported?.compatibilityClass).toBe('unsupported');
    expect(unsupported?.blockingReasons).toContain('unsupported_mission_type');

    const inconclusive = result.candidateTeams.find((entry) => entry.teamId === 'team-inconclusive');
    expect(inconclusive?.compatibilityClass).toBe('inconclusive');
    expect(inconclusive?.assignmentReadiness).toBe('inconclusive');

    expect(result.compatibilityState).toBe('ready');
  });

  it('T-TC-E2 identity generation and repeated evaluation are deterministic', () => {
    const evaluator = createEvaluator();

    const first = evaluator.evaluateMissionCompatibility('mission-1');
    const second = evaluator.evaluateMissionCompatibility('mission-1');

    expect(first).toEqual(second);
    expect(first.compatibilitySet.compatibilitySetId).toBe(second.compatibilitySet.compatibilitySetId);
  });

  it('T-TC-E3 optional template matching is deterministic when templateId is absent', () => {
    const evaluator = createEvaluator();

    const result = evaluator.evaluateMissionCompatibility('mission-1').compatibilitySet;
    expect(result.templateId).toBeUndefined();
    expect(result.limitations).toContain('template_id_unavailable');
    expect(result.candidateTeams.every((entry) => entry.supportedTemplateMatch === null)).toBe(true);
  });
});
