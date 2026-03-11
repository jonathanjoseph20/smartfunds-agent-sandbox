import { describe, expect, it } from 'vitest';

import type { CohortInspection } from '../cohorts/cohort-inspection.ts';
import type { InvestigationInspection } from '../investigations/investigation-inspection.ts';
import type { SynthesisInspection } from '../synthesis/synthesis-inspection.ts';

import type { ResearchTeamAttachmentResolver } from './research-team-attachment.ts';
import { createResearchTeamStatusEvaluator } from './research-team-status.ts';
import type { ResearchTeamRegistry } from './research-team-registry.ts';

function createEvaluator(input: {
  enabled: boolean;
  attachmentCohorts: string[];
  cohortStatuses: Record<string, { readiness: string; health: string; escalation: string; investigations: string[]; syntheses: string[]; programs: string[] }>;
  investigationHealth: Record<string, string>;
  synthesisConflicts: Record<string, number>;
}) {
  const registry = {
    getResearchTeam: () => ({
      teamId: 'team-1',
      displayName: 'Team 1',
      teamType: 'risk',
      enabled: input.enabled,
      attachmentRules: { cohortIds: ['a'] }
    })
  } as unknown as ResearchTeamRegistry;

  const attachmentResolver = {
    resolveAttachmentsForTeam: () => input.attachmentCohorts.map((cohortId) => ({
      teamId: 'team-1',
      cohortId,
      attachmentReason: ['cohort_id_match']
    }))
  } as unknown as ResearchTeamAttachmentResolver;

  const cohortInspection = {
    listCohortPrograms: (cohortId: string) => input.cohortStatuses[cohortId]?.programs.map((programId) => ({ programId })) ?? [],
    inspectLinks: (cohortId: string) => ({
      cohortId,
      linkedInvestigations: input.cohortStatuses[cohortId]?.investigations ?? [],
      linkedSyntheses: input.cohortStatuses[cohortId]?.syntheses ?? []
    }),
    inspectStatus: (cohortId: string) => ({
      cohortId,
      readiness: input.cohortStatuses[cohortId]?.readiness ?? 'pending',
      health: input.cohortStatuses[cohortId]?.health ?? 'degraded'
    }),
    inspectCohortEscalation: ({ cohortId }: { cohortId: string }) => ({
      cohortId,
      escalationState: input.cohortStatuses[cohortId]?.escalation ?? 'none'
    })
  } as unknown as CohortInspection;

  const investigationInspection = {
    inspectCompletionStatus: (investigationId: string) => ({
      investigationRunId: investigationId,
      readinessState: 'inconclusive',
      convergenceState: 'inconclusive',
      healthState: input.investigationHealth[investigationId] ?? 'healthy',
      blockingReasons: [],
      strengths: [],
      limitations: []
    })
  } as unknown as InvestigationInspection;

  const synthesisInspection = {
    inspectConflicts: (synthesisId: string) => ({
      synthesisId,
      conflicts: Array.from({ length: input.synthesisConflicts[synthesisId] ?? 0 }).map((_, idx) => ({ id: idx }))
    })
  } as unknown as SynthesisInspection;

  return createResearchTeamStatusEvaluator({
    teamRegistry: registry,
    attachmentResolver,
    cohortInspection,
    investigationInspection,
    synthesisInspection
  });
}

describe('research team status evaluator', () => {
  it('T-RT-S1 computes inactive for no attachments', () => {
    const evaluator = createEvaluator({
      enabled: true,
      attachmentCohorts: [],
      cohortStatuses: {},
      investigationHealth: {},
      synthesisConflicts: {}
    });

    expect(evaluator.evaluateTeamStatus('team-1').activityState).toBe('inactive');
  });

  it('T-RT-S2 computes monitoring when no escalation and not all stable', () => {
    const evaluator = createEvaluator({
      enabled: true,
      attachmentCohorts: ['c1'],
      cohortStatuses: {
        c1: {
          readiness: 'active',
          health: 'healthy',
          escalation: 'none',
          investigations: ['i1'],
          syntheses: [],
          programs: ['p1']
        }
      },
      investigationHealth: { i1: 'healthy' },
      synthesisConflicts: {}
    });

    expect(evaluator.evaluateTeamStatus('team-1').activityState).toBe('monitoring');
  });

  it('T-RT-S3 computes active_response for degraded cohorts', () => {
    const evaluator = createEvaluator({
      enabled: true,
      attachmentCohorts: ['c1'],
      cohortStatuses: {
        c1: {
          readiness: 'active',
          health: 'degraded',
          escalation: 'none',
          investigations: ['i1'],
          syntheses: [],
          programs: ['p1']
        }
      },
      investigationHealth: { i1: 'healthy' },
      synthesisConflicts: {}
    });

    expect(evaluator.evaluateTeamStatus('team-1').activityState).toBe('active_response');
  });

  it('T-RT-S4 computes escalated_response for escalated cohorts', () => {
    const evaluator = createEvaluator({
      enabled: true,
      attachmentCohorts: ['c1'],
      cohortStatuses: {
        c1: {
          readiness: 'active',
          health: 'degraded',
          escalation: 'escalated',
          investigations: ['i1'],
          syntheses: [],
          programs: ['p1']
        }
      },
      investigationHealth: { i1: 'healthy' },
      synthesisConflicts: {}
    });

    expect(evaluator.evaluateTeamStatus('team-1').activityState).toBe('escalated_response');
  });

  it('T-RT-S5 computes stable for all stable cohorts', () => {
    const evaluator = createEvaluator({
      enabled: true,
      attachmentCohorts: ['c1'],
      cohortStatuses: {
        c1: {
          readiness: 'ready',
          health: 'healthy',
          escalation: 'none',
          investigations: ['i1'],
          syntheses: ['s1'],
          programs: ['p1']
        }
      },
      investigationHealth: { i1: 'healthy' },
      synthesisConflicts: { s1: 0 }
    });

    const status = evaluator.evaluateTeamStatus('team-1');
    expect(status.activityState).toBe('stable');
    expect(status.healthState).toBe('healthy');
  });
});
