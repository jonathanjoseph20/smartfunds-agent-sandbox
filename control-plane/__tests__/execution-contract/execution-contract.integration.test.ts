import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { deriveMissionIdFromPayload } from '../../missions/mission-identity.ts';
import { createMissionActivationInspection } from '../../mission-activation/mission-activation-inspection.ts';
import { createMissionAssignmentInspection } from '../../mission-assignment/mission-assignment-inspection.ts';
import { createTeamCompatibilityInspection } from '../../team-compatibility/team-compatibility-inspection.ts';
import { createExecutionContractInspection } from '../../execution-contract/execution-contract-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-execution-contract-integration');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function seedFixtures(): {
  missionDefinitionsDir: string;
  missionInstancesDir: string;
  teamDefinitionsDir: string;
  compatibilityArtifactsRoot: string;
  assignmentArtifactsRoot: string;
  activationArtifactsRoot: string;
  executionContractArtifactsRoot: string;
  missionId: string;
  missionFilePath: string;
  teamFilePath: string;
} {
  const missionDefinitionsDir = path.join(tmpRoot, 'missions', 'definitions');
  const missionInstancesDir = path.join(tmpRoot, 'missions', 'instances');
  const teamDefinitionsDir = path.join(tmpRoot, 'teams', 'definitions');
  const compatibilityArtifactsRoot = path.join(tmpRoot, 'artifacts', 'team-compatibility');
  const assignmentArtifactsRoot = path.join(tmpRoot, 'artifacts', 'mission-assignment');
  const activationArtifactsRoot = path.join(tmpRoot, 'artifacts', 'mission-activation');
  const executionContractArtifactsRoot = path.join(tmpRoot, 'artifacts', 'execution-contract');

  writeJson(path.join(missionDefinitionsDir, 'generate-product-spec.json'), {
    missionType: 'generate-product-spec',
    displayName: 'Generate Product Spec',
    enabled: true,
    description: 'desc',
    defaultObjective: 'objective',
    defaultDeliverables: ['product_spec', 'mvp_scope'],
    allowedSourceKinds: ['memo'],
    defaultPriority: 'normal',
    defaultLifecycleState: 'draft',
    tags: ['product'],
  });

  const missionId = deriveMissionIdFromPayload({
    missionType: 'generate-product-spec',
    objective: 'objective',
    requestedDeliverables: [
      { deliverableId: 'product_spec' },
      { deliverableId: 'mvp_scope' },
    ],
    sourceReferences: [{ sourceKind: 'memo', sourceId: 'memo-1', reference: 'memo://1' }],
    linkedActionPlanIds: [],
    founderInstructions: 'none',
    createdFrom: { kind: 'founder_directive' },
  });

  const missionFilePath = path.join(missionInstancesDir, `${missionId}.json`);
  writeJson(missionFilePath, {
    missionId,
    missionType: 'generate-product-spec',
    displayName: 'Mission',
    objective: 'objective',
    founderInstructions: 'none',
    requestedDeliverables: [
      { deliverableId: 'product_spec' },
      { deliverableId: 'mvp_scope' },
    ],
    sourceReferences: [{ sourceKind: 'memo', sourceId: 'memo-1', reference: 'memo://1' }],
    linkedActionPlanIds: [],
    linkedPortfolioIds: [],
    linkedMarketSynthesisIds: [],
    recommendedTeamIds: [],
    assignedTeamIds: [],
    approvalState: 'approved',
    lifecycleState: 'draft',
    readinessState: 'ready',
    completionState: 'not_started',
    blockingReasons: [],
    limitations: [],
    createdFrom: { kind: 'founder_directive' },
    historyDigest: '',
  });

  const teamFilePath = path.join(teamDefinitionsDir, 'team-ready.json');
  writeJson(teamFilePath, {
    teamId: 'team-ready',
    displayName: 'team-ready',
    description: 'desc',
    teamType: 'engineering',
    purpose: 'purpose',
    domainTags: ['product'],
    supportedMissionTypes: ['generate-product-spec'],
    supportedTemplateIds: ['generate-product-spec'],
    capabilityTags: ['product_spec', 'mvp_scope'],
    defaultOperatingMode: 'on_demand',
    lifecycleState: 'active',
    availabilityState: 'available',
    readinessState: 'ready',
    rosterPolicy: {
      type: 'expandable',
      minAgents: 1,
      maxAgents: 2,
      requiredCapabilities: ['product_spec'],
    },
    notes: ['note'],
  });

  return {
    missionDefinitionsDir,
    missionInstancesDir,
    teamDefinitionsDir,
    compatibilityArtifactsRoot,
    assignmentArtifactsRoot,
    activationArtifactsRoot,
    executionContractArtifactsRoot,
    missionId,
    missionFilePath,
    teamFilePath,
  };
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('execution contract integration', () => {
  it('T-MEC-I1 end-to-end execution contract flow is deterministic and projection-only', () => {
    const fixtures = seedFixtures();

    const compatibilityInspection = createTeamCompatibilityInspection({
      missionDefinitionsDir: fixtures.missionDefinitionsDir,
      missionInstancesDir: fixtures.missionInstancesDir,
      teamDefinitionsDir: fixtures.teamDefinitionsDir,
      compatibilityArtifactsRoot: fixtures.compatibilityArtifactsRoot,
    });

    const assignmentInspection = createMissionAssignmentInspection({
      missionDefinitionsDir: fixtures.missionDefinitionsDir,
      missionInstancesDir: fixtures.missionInstancesDir,
      teamDefinitionsDir: fixtures.teamDefinitionsDir,
      compatibilityArtifactsRoot: fixtures.compatibilityArtifactsRoot,
      assignmentArtifactsRoot: fixtures.assignmentArtifactsRoot,
    });

    const activationInspection = createMissionActivationInspection({
      missionDefinitionsDir: fixtures.missionDefinitionsDir,
      missionInstancesDir: fixtures.missionInstancesDir,
      teamDefinitionsDir: fixtures.teamDefinitionsDir,
      compatibilityArtifactsRoot: fixtures.compatibilityArtifactsRoot,
      assignmentArtifactsRoot: fixtures.assignmentArtifactsRoot,
      activationArtifactsRoot: fixtures.activationArtifactsRoot,
    });

    const executionInspection = createExecutionContractInspection({
      missionDefinitionsDir: fixtures.missionDefinitionsDir,
      missionInstancesDir: fixtures.missionInstancesDir,
      teamDefinitionsDir: fixtures.teamDefinitionsDir,
      compatibilityArtifactsRoot: fixtures.compatibilityArtifactsRoot,
      assignmentArtifactsRoot: fixtures.assignmentArtifactsRoot,
      activationArtifactsRoot: fixtures.activationArtifactsRoot,
      executionContractArtifactsRoot: fixtures.executionContractArtifactsRoot,
    });

    const missionBefore = fs.readFileSync(fixtures.missionFilePath, 'utf8');
    const teamBefore = fs.readFileSync(fixtures.teamFilePath, 'utf8');

    compatibilityInspection.evaluateCompatibilityByMission(fixtures.missionId);

    const assigned = assignmentInspection.confirmAssignment({ missionId: fixtures.missionId });
    expect(assigned.decisionState).toBe('confirmed');

    const activated = activationInspection.evaluateActivation({
      missionId: fixtures.missionId,
      activationPolicyId: 'confirmed-assignment-default',
    });
    expect(activated.activationState).toBe('ready_for_activation');

    const assignmentBeforeExecution = assignmentInspection.inspectAssignment({ missionId: fixtures.missionId });
    const activationBeforeExecution = activationInspection.inspectActivationDecision({
      missionId: fixtures.missionId,
      activationPolicyId: 'confirmed-assignment-default',
    });

    const evaluated = executionInspection.evaluateExecutionContract({
      missionId: fixtures.missionId,
      executionPolicyId: 'strict-runtime-handoff-default',
    });

    const evaluatedAgain = executionInspection.evaluateExecutionContract({
      missionId: fixtures.missionId,
      executionPolicyId: 'strict-runtime-handoff-default',
    });

    expect(evaluated.executionContractId).toBe(evaluatedAgain.executionContractId);
    expect(evaluated.contractState).toBe('under_review');

    const confirmed = executionInspection.confirmExecutionContract({
      missionId: fixtures.missionId,
      executionPolicyId: 'strict-runtime-handoff-default',
      reviewedBy: 'founder',
    });

    expect(confirmed.contractState).toBe('ready_for_runtime_handoff');
    expect(confirmed.runtimeEnvelopeStub.executionAttemptSupported).toBe(false);

    const inspected = executionInspection.inspectExecutionContract({
      missionId: fixtures.missionId,
      executionPolicyId: 'strict-runtime-handoff-default',
    });

    expect(inspected.executionContractId).toBe(confirmed.executionContractId);

    const materialized = executionInspection.materializeExecutionContract({
      missionId: fixtures.missionId,
      executionPolicyId: 'strict-runtime-handoff-default',
    });

    expect(fs.existsSync(materialized.statusPath)).toBe(true);
    expect(fs.existsSync(materialized.reportPath)).toBe(true);
    expect(fs.existsSync(materialized.markdownPath)).toBe(true);
    expect(fs.existsSync(materialized.historyPath)).toBe(true);
    expect(fs.existsSync(materialized.preconditionsPath)).toBe(true);
    expect(fs.existsSync(materialized.runtimeEnvelopePath)).toBe(true);

    const assignmentAfterExecution = assignmentInspection.inspectAssignment({ missionId: fixtures.missionId });
    const activationAfterExecution = activationInspection.inspectActivationDecision({
      missionId: fixtures.missionId,
      activationPolicyId: 'confirmed-assignment-default',
    });

    expect(assignmentAfterExecution).toEqual(assignmentBeforeExecution);
    expect(activationAfterExecution).toEqual(activationBeforeExecution);

    const missionAfter = fs.readFileSync(fixtures.missionFilePath, 'utf8');
    const teamAfter = fs.readFileSync(fixtures.teamFilePath, 'utf8');
    expect(missionAfter).toBe(missionBefore);
    expect(teamAfter).toBe(teamBefore);

    const files = fs.readdirSync(tmpRoot, { recursive: true }) as string[];
    expect(files.some((entry) => entry.includes('runs'))).toBe(false);
    expect(files.some((entry) => entry.includes('scheduler'))).toBe(false);

    const runtimeEnvelope = JSON.parse(fs.readFileSync(materialized.runtimeEnvelopePath, 'utf8')) as {
      executionAttemptSupported: boolean;
      taskGraphSupported: boolean;
      retryPolicySupported: boolean;
      resourceBindingSupported: boolean;
    };

    expect(runtimeEnvelope.executionAttemptSupported).toBe(false);
    expect(runtimeEnvelope.taskGraphSupported).toBe(false);
    expect(runtimeEnvelope.retryPolicySupported).toBe(false);
    expect(runtimeEnvelope.resourceBindingSupported).toBe(false);
  });
});
