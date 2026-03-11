import { describe, expect, it } from 'vitest';

import { evaluateMissionStatus } from '../../missions/mission-status.ts';
import type { MissionInstance } from '../../missions/mission-instance-types.ts';

function buildInstance(overrides: Partial<MissionInstance> = {}): MissionInstance {
  return {
    missionId: 'mission-1',
    missionType: 'produce-market-memo',
    displayName: 'Produce Market Memo',
    objective: 'Produce a bounded market memo',
    founderInstructions: 'Focus on downside scenarios',
    requestedDeliverables: [
      { deliverableId: 'market_summary' },
      { deliverableId: 'risk_opportunity_brief' },
    ],
    sourceReferences: [
      { sourceKind: 'memo', sourceId: 'memo-1', reference: 'memo://1' },
    ],
    linkedActionPlanIds: ['plan-1'],
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
    createdFrom: { kind: 'founder_directive' },
    historyDigest: '',
    ...overrides,
  };
}

describe('mission status', () => {
  it('T-MS1 approval pending keeps readiness pending', () => {
    const status = evaluateMissionStatus({
      missionInstance: buildInstance({ approvalState: 'pending_review' }),
    });

    expect(status.readinessState).toBe('pending');
    expect(status.blockingReasons).toContain('approval_pending_review');
  });

  it('T-MS2 approved but inactive mission keeps draft lifecycle and ready readiness', () => {
    const status = evaluateMissionStatus({
      missionInstance: buildInstance({ approvalState: 'approved', lifecycleState: 'draft' }),
    });

    expect(status.lifecycleState).toBe('draft');
    expect(status.readinessState).toBe('ready');
  });

  it('T-MS3 blocked upstream reference sets readiness blocked', () => {
    const status = evaluateMissionStatus({
      missionInstance: buildInstance({ approvalState: 'approved' }),
      linkedActionPlanStates: [{ actionPlanId: 'plan-1', blocked: true }],
    });

    expect(status.readinessState).toBe('blocked');
    expect(status.blockingReasons).toContain('linked_action_plan_blocked:plan-1');
  });

  it('T-MS4 missing objective marks readiness incomplete', () => {
    const status = evaluateMissionStatus({
      missionInstance: buildInstance({
        approvalState: 'approved',
        objective: '',
      }),
    });

    expect(status.readinessState).toBe('incomplete');
    expect(status.limitations).toContain('missing_objective');
  });

  it('T-MS5 all deliverables satisfied marks completion completed', () => {
    const status = evaluateMissionStatus({
      missionInstance: buildInstance({ approvalState: 'approved', lifecycleState: 'active' }),
      deliverableDeclarations: [
        { deliverableId: 'market_summary', satisfied: true },
        { deliverableId: 'risk_opportunity_brief', satisfied: true },
      ],
    });

    expect(status.completionState).toBe('completed');
    expect(status.lifecycleState).toBe('completed');
  });

  it('T-MS6 conflicting deliverable declarations produce inconclusive completion', () => {
    const status = evaluateMissionStatus({
      missionInstance: buildInstance({ approvalState: 'approved', lifecycleState: 'active' }),
      deliverableDeclarations: [
        { deliverableId: 'market_summary', satisfied: true },
        { deliverableId: 'market_summary', satisfied: false },
      ],
    });

    expect(status.completionState).toBe('inconclusive');
    expect(status.readinessState).toBe('inconclusive');
  });
});
