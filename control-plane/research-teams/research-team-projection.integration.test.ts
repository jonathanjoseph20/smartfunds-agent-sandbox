import { describe, expect, it } from 'vitest';

import type { CohortInspection } from '../cohorts/cohort-inspection.ts';

import type { ResearchTeamAttachmentResolver } from './research-team-attachment.ts';
import { createResearchTeamInspection } from './research-team-inspection.ts';
import type { ResearchTeamProjectionEngine } from './research-team-projection.ts';
import type { ResearchTeamRegistry } from './research-team-registry.ts';
import type { ResearchTeamStatusEvaluator } from './research-team-status.ts';

describe('research team integration', () => {
  it('T-RT-I1 escalation activates team and records history', () => {
    const inspection = createResearchTeamInspection({
      registry: {
        listResearchTeams: () => [{ teamId: 't1', displayName: 'T1', teamType: 'risk', enabled: true, attachmentRules: { cohortIds: ['c1'] } }],
        getResearchTeam: () => ({ teamId: 't1', displayName: 'T1', teamType: 'risk', enabled: true, attachmentRules: { cohortIds: ['c1'] } })
      } as unknown as ResearchTeamRegistry,
      attachmentResolver: {
        resolveAttachmentsForTeam: () => [{ teamId: 't1', cohortId: 'c1', attachmentReason: ['cohort_id_match:c1'] }]
      } as unknown as ResearchTeamAttachmentResolver,
      statusEvaluator: {
        evaluateTeamStatus: () => ({
          teamId: 't1',
          activityState: 'escalated_response',
          healthState: 'active',
          linkedCohortIds: ['c1'],
          linkedProgramIds: ['p1'],
          linkedInvestigationIds: ['i1'],
          linkedSynthesisIds: ['s1'],
          responseReasons: ['cohort_escalated']
        })
      } as unknown as ResearchTeamStatusEvaluator,
      projection: {
        projectOne: () => ({
          team: { teamId: 't1', displayName: 'T1', teamType: 'risk', enabled: true, attachmentRules: { cohortIds: ['c1'] } },
          attachments: [{ teamId: 't1', cohortId: 'c1', attachmentReason: ['cohort_id_match:c1'] }],
          status: {
            teamId: 't1',
            activityState: 'escalated_response',
            healthState: 'active',
            linkedCohortIds: ['c1'],
            linkedProgramIds: ['p1'],
            linkedInvestigationIds: ['i1'],
            linkedSynthesisIds: ['s1'],
            responseReasons: ['cohort_escalated']
          },
          linkedPrograms: [{ cohortId: 'c1', programId: 'p1' }],
          linkedInvestigations: ['i1'],
          linkedSyntheses: ['s1']
        })
      } as unknown as ResearchTeamProjectionEngine,
      cohortInspection: {
        listCohortPrograms: () => [{ programId: 'p1' }]
      } as unknown as CohortInspection
    });

    const materialized = inspection.materializeTeam({ teamId: 't1', slotReference: 'daily:2026-03-11' });
    expect(materialized.teamId).toBe('t1');

    const history = inspection.inspectHistory('t1');
    expect(history.entries.some((entry) => entry.eventType === 'team_escalated')).toBe(true);
  });

  it('T-RT-I2 stable topic remains monitoring and T-RT-I3 aggregates multi-cohort links', () => {
    const inspection = createResearchTeamInspection({
      registry: {
        listResearchTeams: () => [{ teamId: 't2', displayName: 'T2', teamType: 'monitoring', enabled: true, attachmentRules: { cohortTypes: ['risk'] } }],
        getResearchTeam: () => ({ teamId: 't2', displayName: 'T2', teamType: 'monitoring', enabled: true, attachmentRules: { cohortTypes: ['risk'] } })
      } as unknown as ResearchTeamRegistry,
      attachmentResolver: {
        resolveAttachmentsForTeam: () => [
          { teamId: 't2', cohortId: 'c1', attachmentReason: ['cohort_type_match:risk'] },
          { teamId: 't2', cohortId: 'c2', attachmentReason: ['cohort_type_match:risk'] }
        ]
      } as unknown as ResearchTeamAttachmentResolver,
      statusEvaluator: {
        evaluateTeamStatus: () => ({
          teamId: 't2',
          activityState: 'monitoring',
          healthState: 'healthy',
          linkedCohortIds: ['c1', 'c2'],
          linkedProgramIds: ['p1', 'p2'],
          linkedInvestigationIds: ['i1', 'i2'],
          linkedSynthesisIds: ['s1', 's2'],
          responseReasons: ['no_escalation_signals']
        })
      } as unknown as ResearchTeamStatusEvaluator,
      projection: {
        projectOne: () => ({
          team: { teamId: 't2', displayName: 'T2', teamType: 'monitoring', enabled: true, attachmentRules: { cohortTypes: ['risk'] } },
          attachments: [
            { teamId: 't2', cohortId: 'c1', attachmentReason: ['cohort_type_match:risk'] },
            { teamId: 't2', cohortId: 'c2', attachmentReason: ['cohort_type_match:risk'] }
          ],
          status: {
            teamId: 't2',
            activityState: 'monitoring',
            healthState: 'healthy',
            linkedCohortIds: ['c1', 'c2'],
            linkedProgramIds: ['p1', 'p2'],
            linkedInvestigationIds: ['i1', 'i2'],
            linkedSynthesisIds: ['s1', 's2'],
            responseReasons: ['no_escalation_signals']
          },
          linkedPrograms: [
            { cohortId: 'c1', programId: 'p1' },
            { cohortId: 'c2', programId: 'p2' }
          ],
          linkedInvestigations: ['i1', 'i2'],
          linkedSyntheses: ['s1', 's2']
        })
      } as unknown as ResearchTeamProjectionEngine,
      cohortInspection: {
        listCohortPrograms: (cohortId: string) => [{ programId: cohortId === 'c1' ? 'p1' : 'p2' }]
      } as unknown as CohortInspection
    });

    const links = inspection.inspectLinks('t2');
    expect(links.cohorts).toEqual(['c1', 'c2']);
    expect(links.programs).toEqual(['p1', 'p2']);
    expect(inspection.inspectStatus('t2').activityState).toBe('monitoring');
  });
});
