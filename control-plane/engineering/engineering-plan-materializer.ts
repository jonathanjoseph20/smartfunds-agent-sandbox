import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import { createEngineeringPlanManager } from './engineering-plan-manager.ts';
import { validateEngineeringPlan } from './engineering-plan-validation.ts';

type EngineeringPlanMaterializerManager = ReturnType<typeof createEngineeringPlanManager>;

const DEFAULT_ENGINEERING_ARTIFACTS_ROOT = path.join('artifacts', 'engineering');

function toMarkdownReport(input: {
  plan: unknown;
  projection: unknown;
  validation: unknown;
  history: unknown;
}): string {
  const lines = [
    '# Engineering Plan Report',
    '',
    `${canonicalStringify(input)}`,
  ];

  return `${lines.join('\n')}\n`;
}

export function createEngineeringPlanMaterializer(options: {
  manager?: EngineeringPlanMaterializerManager;
  artifactsRoot?: string;
  plansFilePath?: string;
  historyFilePath?: string;
} = {}) {
  const manager = options.manager ?? createEngineeringPlanManager({
    plansFilePath: options.plansFilePath,
    historyFilePath: options.historyFilePath,
  });
  const artifactsRoot = options.artifactsRoot ?? DEFAULT_ENGINEERING_ARTIFACTS_ROOT;

  function materializeEngineeringPlan(planId: string): {
    planId: string;
    engineeringPlanPath: string;
    statusPath: string;
    validationPath: string;
    reportPath: string;
  } {
    const plan = manager.getEngineeringPlan(planId);
    const validation = validateEngineeringPlan(plan);
    const projection = manager.deriveEngineeringPlanProjection(planId);
    const history = manager.historyStore.listEngineeringPlanEvents(planId);

    const dirPath = path.join(artifactsRoot, planId);
    fs.mkdirSync(dirPath, { recursive: true });

    const engineeringPlanPath = path.join(dirPath, 'engineering-plan.json');
    const statusPath = path.join(dirPath, 'engineering-plan-status.json');
    const validationPath = path.join(dirPath, 'engineering-plan-validation.json');
    const reportPath = path.join(dirPath, 'engineering-plan-report.md');

    fs.writeFileSync(engineeringPlanPath, `${canonicalStringify(plan)}\n`, 'utf8');
    fs.writeFileSync(statusPath, `${canonicalStringify({ planId, status: projection.status })}\n`, 'utf8');
    fs.writeFileSync(validationPath, `${canonicalStringify(validation)}\n`, 'utf8');
    fs.writeFileSync(reportPath, toMarkdownReport({ plan, projection, validation, history }), 'utf8');

    return {
      planId,
      engineeringPlanPath,
      statusPath,
      validationPath,
      reportPath,
    };
  }

  return {
    materializeEngineeringPlan,
  };
}

export type EngineeringPlanMaterializer = ReturnType<typeof createEngineeringPlanMaterializer>;
