import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createActionPlanHistoryStore } from './action-plan-history-store.ts';
import { createActionPlanInspection } from './action-plan-inspection.ts';
import { createActionPlanMaterializer } from './action-plan-materializer.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-action-orchestration-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function buildInspectionWithStatuses(statusByPlanId: Record<string, any>) {
  return createActionPlanInspection({
    registry: {
      getActionPlanDefinitions: () => Object.keys(statusByPlanId).sort((a, b) => a.localeCompare(b)).map((actionPlanId) => ({
        actionPlanId,
        displayName: `${actionPlanId} display`,
        planType: 'coordination',
        enabled: true,
        matchingRules: {},
      })),
      getActionPlanDefinitionById: (actionPlanId: string) => {
        const status = statusByPlanId[actionPlanId];
        if (!status) {
          throw new Error(`ACTION_PLAN_NOT_FOUND: ${actionPlanId}`);
        }
        return {
          actionPlanId,
          displayName: status.displayName,
          planType: status.planType,
          enabled: true,
          matchingRules: {},
        };
      },
    } as any,
    linker: {
      buildLinks: () => Object.keys(statusByPlanId).sort((a, b) => a.localeCompare(b)).map((actionPlanId) => ({
        actionPlanId,
        linkedActionIds: statusByPlanId[actionPlanId].linkedActionIds,
        linkedActions: statusByPlanId[actionPlanId].linkedActions,
        riskThemes: statusByPlanId[actionPlanId].riskThemes,
        routeCategories: statusByPlanId[actionPlanId].routeCategories,
        rationale: statusByPlanId[actionPlanId].rationale,
      })),
    } as any,
    statusProjection: {
      projectOne: (actionPlanId: string) => {
        const found = statusByPlanId[actionPlanId];
        if (!found) {
          throw new Error(`ACTION_PLAN_NOT_FOUND: ${actionPlanId}`);
        }
        return found;
      },
      projectAll: () => Object.values(statusByPlanId),
    } as any,
    actionPlanArtifactsRoot: path.join(tmpRoot, 'artifacts', 'action-orchestration'),
  });
}

describe('action-orchestration integration', () => {
  it('T-AO-I1 positive coherent path projects and materializes deterministically', () => {
    const statusByPlanId = {
      'governance-review-plan': {
        actionPlanId: 'governance-review-plan',
        displayName: 'Governance Review Plan',
        planType: 'governance_review',
        enabled: true,
        lifecycleState: 'active',
        readinessState: 'coherent',
        completionState: 'incomplete',
        priority: 'normal',
        routeSummary: 'review_bundle',
        linkedActionIds: ['review-governance-exposure'],
        linkedActions: [],
        blockingReasons: [],
        strengths: ['linked_actions:1'],
        limitations: [],
        rationale: ['review-governance-exposure:shared_risk_theme:governance_risk_rising'],
        priorityReasons: ['baseline_conditions_met'],
        routeSummaryReasons: ['contains_route_category:review'],
        riskThemes: ['governance_risk_rising'],
        routeCategories: ['review'],
      }
    };

    const inspection = buildInspectionWithStatuses(statusByPlanId);
    const historyStore = createActionPlanHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'action-orchestration'),
    });

    const first = inspection.evaluateActionPlan({
      actionPlanId: 'governance-review-plan',
      slotReference: 'daily:2026-03-11',
    });

    const second = inspection.evaluateActionPlan({
      actionPlanId: 'governance-review-plan',
      slotReference: 'daily:2026-03-11',
    });

    expect(second.history).toEqual(first.history);

    const materializer = createActionPlanMaterializer({
      projection: {
        projectOne: (actionPlanId: string) => inspection.inspectPlan(actionPlanId),
      } as any,
      historyStore,
      actionPlanArtifactsRoot: path.join(tmpRoot, 'artifacts', 'action-orchestration'),
    });

    const materialized = materializer.materializeOne('governance-review-plan');
    expect(fs.existsSync(materialized.statusPath)).toBe(true);
    expect(fs.existsSync(materialized.historyPath)).toBe(true);
    expect(fs.existsSync(materialized.reportPath)).toBe(true);
    expect(fs.existsSync(materialized.markdownPath)).toBe(true);
  });

  it('T-AO-I2 conflict-heavy path stays blocked and escalated', () => {
    const inspection = buildInspectionWithStatuses({
      'risk-reduction-plan': {
        actionPlanId: 'risk-reduction-plan',
        displayName: 'Risk Reduction Plan',
        planType: 'risk_reduction',
        enabled: true,
        lifecycleState: 'stabilizing',
        readinessState: 'blocked',
        completionState: 'inconclusive',
        priority: 'critical',
        routeSummary: 'escalate_bundle',
        linkedActionIds: ['reduce-risk-exposure'],
        linkedActions: [],
        blockingReasons: ['blocked_action_candidate_present'],
        strengths: [],
        limitations: ['completion_inconclusive'],
        rationale: [],
        priorityReasons: ['linked_action_priority:critical'],
        routeSummaryReasons: ['contains_route_category:escalate'],
        riskThemes: ['liquidity_stress'],
        routeCategories: ['escalate'],
      }
    });

    const status = inspection.getPlanStatus('risk-reduction-plan');
    expect(status.readinessState).toBe('blocked');
    expect(status.routeSummary).toBe('escalate_bundle');
  });

  it('T-AO-I3 inconclusive path remains conservative', () => {
    const inspection = buildInspectionWithStatuses({
      'yield-instability-plan': {
        actionPlanId: 'yield-instability-plan',
        displayName: 'Yield Instability Plan',
        planType: 'yield_instability',
        enabled: true,
        lifecycleState: 'stabilizing',
        readinessState: 'analyzing',
        completionState: 'inconclusive',
        priority: 'high',
        routeSummary: 'allocation_review_bundle',
        linkedActionIds: ['review-yield-instability'],
        linkedActions: [],
        blockingReasons: [],
        strengths: [],
        limitations: ['completion_inconclusive'],
        rationale: [],
        priorityReasons: ['plan_completion:inconclusive'],
        routeSummaryReasons: ['contains_route_category:prepare_allocation_review'],
        riskThemes: ['yield_instability'],
        routeCategories: ['prepare_allocation_review'],
      }
    });

    const readiness = inspection.getPlanReadiness('yield-instability-plan');
    expect(readiness.completionState).toBe('inconclusive');
    expect(readiness.limitations).toContain('completion_inconclusive');
  });
});
