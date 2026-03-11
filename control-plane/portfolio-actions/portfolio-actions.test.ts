import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createPortfolioActionHistoryStore } from './portfolio-action-history-store.ts';
import { createPortfolioActionInspection } from './portfolio-action-inspection.ts';
import { createPortfolioActionMaterializer } from './portfolio-action-materializer.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-portfolio-actions-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function buildInspectionWithStatuses(statusByActionId: Record<string, any>) {
  return createPortfolioActionInspection({
    registry: {
      getActionDefinitions: () => Object.keys(statusByActionId).sort((a, b) => a.localeCompare(b)).map((actionId) => ({
        actionId,
        displayName: `${actionId} display`,
        actionType: 'routing',
        enabled: true,
        portfolioMatchRules: {},
      })),
      getActionDefinitionById: (actionId: string) => {
        const status = statusByActionId[actionId];
        if (!status) {
          throw new Error(`PORTFOLIO_ACTION_NOT_FOUND: ${actionId}`);
        }
        return {
          actionId,
          displayName: status.displayName,
          actionType: status.actionType,
          enabled: true,
          portfolioMatchRules: {},
        };
      }
    } as any,
    linker: {
      buildLinks: () => Object.keys(statusByActionId).sort((a, b) => a.localeCompare(b)).map((actionId) => ({
        actionId,
        linkedPortfolioIds: statusByActionId[actionId].linkedPortfolioIds,
        linkedPortfolios: statusByActionId[actionId].linkedPortfolios,
        riskThemes: statusByActionId[actionId].riskThemes,
        exposureFlags: statusByActionId[actionId].exposureFlags,
        concentrationWarnings: statusByActionId[actionId].concentrationWarnings,
        rationale: statusByActionId[actionId].rationale,
      }))
    } as any,
    statusProjection: {
      projectOne: (actionId: string) => {
        const found = statusByActionId[actionId];
        if (!found) {
          throw new Error(`PORTFOLIO_ACTION_NOT_FOUND: ${actionId}`);
        }
        return found;
      },
      projectAll: () => Object.values(statusByActionId)
    } as any,
    portfolioActionArtifactsRoot: path.join(tmpRoot, 'artifacts', 'portfolio-actions')
  });
}

describe('portfolio-actions integration', () => {
  it('T-PA-I1 positive action path projects and materializes deterministically', () => {
    const statusByActionId = {
      'review-governance-exposure': {
        actionId: 'review-governance-exposure',
        displayName: 'Review Governance Exposure',
        actionType: 'governance_review',
        enabled: true,
        lifecycleState: 'active',
        readinessState: 'ready',
        completionState: 'incomplete',
        priority: 'normal',
        routeCategory: 'review',
        linkedPortfolioIds: ['governance-sensitive-portfolio'],
        linkedPortfolios: [{
          portfolioId: 'governance-sensitive-portfolio',
          displayName: 'Governance',
          portfolioType: 'governance',
          lifecycleState: 'active',
          readinessState: 'coherent',
          completionState: 'incomplete',
          blockingReasons: [],
          limitations: [],
          riskThemes: ['governance_risk_rising'],
          exposureFlags: ['event_exposure:governance'],
          concentrationWarnings: []
        }],
        blockingReasons: [],
        riskThemes: ['governance_risk_rising'],
        exposureFlags: ['event_exposure:governance'],
        concentrationWarnings: [],
        strengths: ['linked_portfolios:1'],
        limitations: [],
        rationale: ['governance-sensitive-portfolio:shared_risk_theme:governance_risk_rising'],
        priorityReasons: ['analysis_in_progress']
      }
    };

    const inspection = buildInspectionWithStatuses(statusByActionId);
    const historyStore = createPortfolioActionHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'portfolio-actions')
    });

    const first = inspection.evaluatePortfolioAction({
      actionId: 'review-governance-exposure',
      slotReference: 'daily:2026-03-11'
    });
    const second = inspection.evaluatePortfolioAction({
      actionId: 'review-governance-exposure',
      slotReference: 'daily:2026-03-11'
    });

    expect(second.history).toEqual(first.history);

    const materializer = createPortfolioActionMaterializer({
      inspection,
      historyStore,
      portfolioActionArtifactsRoot: path.join(tmpRoot, 'artifacts', 'portfolio-actions')
    });

    const materialized = materializer.materializeOne('review-governance-exposure');
    expect(fs.existsSync(materialized.statusPath)).toBe(true);
    expect(fs.existsSync(materialized.historyPath)).toBe(true);
    expect(fs.existsSync(materialized.reportPath)).toBe(true);
    expect(fs.existsSync(materialized.markdownPath)).toBe(true);
  });

  it('T-PA-I2 conflict-heavy path stays blocked and escalated', () => {
    const inspection = buildInspectionWithStatuses({
      'reduce-risk-exposure': {
        actionId: 'reduce-risk-exposure',
        displayName: 'Reduce Risk Exposure',
        actionType: 'risk_reduction',
        enabled: true,
        lifecycleState: 'stabilizing',
        readinessState: 'blocked',
        completionState: 'inconclusive',
        priority: 'critical',
        routeCategory: 'escalate',
        linkedPortfolioIds: ['defi-core-portfolio'],
        linkedPortfolios: [],
        blockingReasons: ['unresolved_market_conflicts'],
        riskThemes: ['liquidity_stress'],
        exposureFlags: ['blocked_market_synthesis:m1'],
        concentrationWarnings: [],
        strengths: [],
        limitations: ['completion_inconclusive'],
        rationale: [],
        priorityReasons: ['unresolved_market_conflicts']
      }
    });

    const status = inspection.getPortfolioActionStatus('reduce-risk-exposure');
    expect(status.readinessState).toBe('blocked');
    expect(status.routeCategory).toBe('escalate');
  });

  it('T-PA-I3 inconclusive path remains conservative', () => {
    const inspection = buildInspectionWithStatuses({
      'review-yield-instability': {
        actionId: 'review-yield-instability',
        displayName: 'Review Yield Instability',
        actionType: 'yield_review',
        enabled: true,
        lifecycleState: 'stabilizing',
        readinessState: 'analyzing',
        completionState: 'inconclusive',
        priority: 'high',
        routeCategory: 'prepare_allocation_review',
        linkedPortfolioIds: ['yield-sensitive-portfolio'],
        linkedPortfolios: [],
        blockingReasons: [],
        riskThemes: ['yield_instability'],
        exposureFlags: ['inconclusive_market_synthesis:m1'],
        concentrationWarnings: [],
        strengths: [],
        limitations: ['completion_inconclusive'],
        rationale: [],
        priorityReasons: ['completion_inconclusive']
      }
    });

    const readiness = inspection.getPortfolioActionReadiness('review-yield-instability');
    expect(readiness.completionState).toBe('inconclusive');
    expect(readiness.limitations).toContain('completion_inconclusive');
  });

  it('T-PA-I4 regression compatibility keeps upstream snapshots unchanged', () => {
    const upstreamSnapshot = {
      portfolioId: 'defi-core-portfolio',
      lifecycleState: 'progressing',
      readinessState: 'analyzing'
    };
    const before = JSON.stringify(upstreamSnapshot);

    const inspection = buildInspectionWithStatuses({
      'monitor-liquidity-stress': {
        actionId: 'monitor-liquidity-stress',
        displayName: 'Monitor Liquidity Stress',
        actionType: 'liquidity_monitoring',
        enabled: true,
        lifecycleState: 'progressing',
        readinessState: 'analyzing',
        completionState: 'incomplete',
        priority: 'normal',
        routeCategory: 'review',
        linkedPortfolioIds: ['defi-core-portfolio'],
        linkedPortfolios: [],
        blockingReasons: [],
        riskThemes: ['liquidity_stress'],
        exposureFlags: ['event_exposure:liquidity'],
        concentrationWarnings: [],
        strengths: [],
        limitations: [],
        rationale: [],
        priorityReasons: ['analysis_in_progress']
      }
    });

    inspection.evaluatePortfolioAction({
      actionId: 'monitor-liquidity-stress',
      slotReference: 'daily:2026-03-11'
    });

    expect(JSON.stringify(upstreamSnapshot)).toBe(before);
  });
});
