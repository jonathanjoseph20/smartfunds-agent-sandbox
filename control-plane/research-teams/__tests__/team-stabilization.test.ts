import { describe, expect, it } from 'vitest';

import { evaluateTeamReadiness } from '../coordination/team-readiness.ts';
import { evaluateTeamStabilization } from '../coordination/team-stabilization-engine.ts';

describe('team stabilization and readiness', () => {
  it('T-RT-CS1 remains stabilizing until all policy conditions are satisfied', () => {
    const stabilization = evaluateTeamStabilization({
      teamId: 'defi-risk-team',
      healthySlotCount: 1,
      unresolvedInvestigationCount: 1,
      synthesisConflictCount: 1,
      stabilizationRules: {
        requiredHealthySlots: 3,
        requireResolvedInvestigations: true,
        requireClearedConflicts: true
      }
    });

    expect(stabilization.stabilizationState).toBe('stabilizing');
    expect(stabilization.reasons).toContain('healthy_slot_requirement_unmet:1/3');
    expect(stabilization.reasons).toContain('unresolved_investigations:1');
    expect(stabilization.reasons).toContain('synthesis_conflicts:1');
  });

  it('T-RT-CS2 transitions to resolved and readiness resolved when policy conditions pass', () => {
    const stabilization = evaluateTeamStabilization({
      teamId: 'defi-risk-team',
      healthySlotCount: 3,
      unresolvedInvestigationCount: 0,
      synthesisConflictCount: 0,
      stabilizationRules: {
        requiredHealthySlots: 3,
        requireResolvedInvestigations: true,
        requireClearedConflicts: true
      }
    });

    const readiness = evaluateTeamReadiness({
      teamId: 'defi-risk-team',
      teamEnabled: true,
      hasLinkedCohorts: true,
      hasEscalation: false,
      activeInvestigationIds: [],
      priority: 'normal',
      stabilizationState: stabilization.stabilizationState
    });

    expect(stabilization.stabilizationState).toBe('resolved');
    expect(readiness.readiness).toBe('resolved');
  });
});
