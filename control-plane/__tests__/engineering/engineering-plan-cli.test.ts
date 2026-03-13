import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { EngineeringPlanStatus } from '../../engineering/engineering-plan-status.ts';
import { main as createMain } from '../../cli/engineering-plan-create.ts';
import { main as inspectMain } from '../../cli/engineering-plan-inspect.ts';
import { main as listMain } from '../../cli/engineering-plan-list.ts';
import { main as materializeMain } from '../../cli/engineering-plan-materialize.ts';

const {
  createEngineeringPlan,
  listEngineeringPlans,
  inspectEngineeringPlan,
  materializeEngineeringPlan,
} = vi.hoisted(() => ({
  createEngineeringPlan: vi.fn(() => ({
    planId: 'plan-1',
    status: EngineeringPlanStatus.DRAFT,
  })),
  listEngineeringPlans: vi.fn(() => ([
    { planId: 'plan-1', specId: 'spec-1', status: EngineeringPlanStatus.DRAFT },
  ])),
  inspectEngineeringPlan: vi.fn(() => ({
    planId: 'plan-1',
    specId: 'spec-1',
    status: EngineeringPlanStatus.DRAFT,
    validationState: 'valid',
    missingFields: [],
    warnings: [],
    subsystems: ['api'],
    implementationPhases: ['phase-1'],
    dependencies: ['db'],
    integrationRequirements: ['auth-provider'],
  })),
  materializeEngineeringPlan: vi.fn(() => ({
    planId: 'plan-1',
    engineeringPlanPath: 'artifacts/engineering/plan-1/engineering-plan.json',
    statusPath: 'artifacts/engineering/plan-1/engineering-plan-status.json',
    validationPath: 'artifacts/engineering/plan-1/engineering-plan-validation.json',
    reportPath: 'artifacts/engineering/plan-1/engineering-plan-report.md',
  })),
}));

vi.mock('../../engineering/engineering-plan-manager.ts', () => ({
  createEngineeringPlanManager: vi.fn(() => ({
    createEngineeringPlan,
    deriveEngineeringPlanProjection: inspectEngineeringPlan,
  })),
}));

vi.mock('../../engineering/engineering-plan-inspection.ts', () => ({
  createEngineeringPlanInspection: vi.fn(() => ({
    listEngineeringPlans,
    inspectEngineeringPlan,
  })),
}));

vi.mock('../../engineering/engineering-plan-materializer.ts', () => ({
  createEngineeringPlanMaterializer: vi.fn(() => ({
    materializeEngineeringPlan,
  })),
}));

describe('engineering plan CLI', () => {
  it('T-PF2-CLI1 create/list/inspect/materialize output canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await createMain(['--spec', 'spec-1'])).toBe(0);
    expect(await listMain([])).toBe(0);
    expect(await inspectMain(['--plan', 'plan-1'])).toBe(0);
    expect(await materializeMain(['--plan', 'plan-1'])).toBe(0);

    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ planId: 'plan-1', status: EngineeringPlanStatus.DRAFT })}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify([{ planId: 'plan-1', specId: 'spec-1', status: EngineeringPlanStatus.DRAFT }])}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectEngineeringPlan())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(materializeEngineeringPlan())}\n`);

    stdout.mockRestore();
  });

  it('T-PF2-CLI2 returns code 1 with canonical error payload for input errors', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await createMain([])).toBe(1);
    expect(await inspectMain([])).toBe(1);
    expect(await materializeMain([])).toBe(1);
    expect(await listMain(['--bad'])).toBe(1);

    const merged = stdout.mock.calls.map((entry) => String(entry[0])).join('');
    expect(merged).toContain(canonicalStringify({ error: 'MISSING_ARGUMENT: --spec' }));
    expect(merged).toContain(canonicalStringify({ error: 'MISSING_ARGUMENT: --plan' }));
    expect(merged).toContain(canonicalStringify({ error: 'UNKNOWN_ARGUMENT: --bad' }));

    stdout.mockRestore();
  });
});
