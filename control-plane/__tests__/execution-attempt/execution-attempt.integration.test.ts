import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { deriveMissionIdFromPayload } from '../../missions/mission-identity.ts';
import { createMissionActivationInspection } from '../../mission-activation/mission-activation-inspection.ts';
import { createMissionAssignmentInspection } from '../../mission-assignment/mission-assignment-inspection.ts';
import { createTeamCompatibilityInspection } from '../../team-compatibility/team-compatibility-inspection.ts';
import { createExecutionContractInspection } from '../../execution-contract/execution-contract-inspection.ts';
import { createRuntimeEnvelopeInspection } from '../../runtime-envelope/runtime-envelope-inspection.ts';
import { createExecutionAttemptInspection } from '../../execution-attempt/execution-attempt-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-execution-attempt-integration');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function seedFixtures() {
  const missionDefinitionsDir = path.join(tmpRoot, 'missions', 'definitions');
  const missionInstancesDir = path.join(tmpRoot, 'missions', 'instances');
  const teamDefinitionsDir = path.join(tmpRoot, 'teams', 'definitions');
  const compatibilityArtifactsRoot = path.join(tmpRoot, 'artifacts', 'team-compatibility');
  const assignmentArtifactsRoot = path.join(tmpRoot, 'artifacts', 'mission-assignment');
  const activationArtifactsRoot = path.join(tmpRoot, 'artifacts', 'mission-activation');
  const executionContractArtifactsRoot = path.join(tmpRoot, 'artifacts', 'execution-contract');
  const runtimeEnvelopeArtifactsRoot = path.join(tmpRoot, 'artifacts', 'runtime-envelope');
  const executionAttemptArtifactsRoot = path.join(tmpRoot, 'artifacts', 'execution-attempt');

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
    runtimeEnvelopeArtifactsRoot,
    executionAttemptArtifactsRoot,
    missionId,
    missionFilePath,
    teamFilePath,
  };
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('execution attempt integration', () => {
  it('T-MEA-I1 end-to-end attempt flow is deterministic and pre-execution only', () => {
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

    const runtimeInspection = createRuntimeEnvelopeInspection({
      missionDefinitionsDir: fixtures.missionDefinitionsDir,
      missionInstancesDir: fixtures.missionInstancesDir,
      teamDefinitionsDir: fixtures.teamDefinitionsDir,
      compatibilityArtifactsRoot: fixtures.compatibilityArtifactsRoot,
      assignmentArtifactsRoot: fixtures.assignmentArtifactsRoot,
      activationArtifactsRoot: fixtures.activationArtifactsRoot,
      executionContractArtifactsRoot: fixtures.executionContractArtifactsRoot,
      runtimeEnvelopeArtifactsRoot: fixtures.runtimeEnvelopeArtifactsRoot,
    });

    const executionAttemptInspection = createExecutionAttemptInspection({
      missionDefinitionsDir: fixtures.missionDefinitionsDir,
      missionInstancesDir: fixtures.missionInstancesDir,
      teamDefinitionsDir: fixtures.teamDefinitionsDir,
      compatibilityArtifactsRoot: fixtures.compatibilityArtifactsRoot,
      assignmentArtifactsRoot: fixtures.assignmentArtifactsRoot,
      activationArtifactsRoot: fixtures.activationArtifactsRoot,
      executionContractArtifactsRoot: fixtures.executionContractArtifactsRoot,
      runtimeEnvelopeArtifactsRoot: fixtures.runtimeEnvelopeArtifactsRoot,
      executionAttemptArtifactsRoot: fixtures.executionAttemptArtifactsRoot,
    });

    const missionBefore = fs.readFileSync(fixtures.missionFilePath, 'utf8');
    const teamBefore = fs.readFileSync(fixtures.teamFilePath, 'utf8');

    compatibilityInspection.evaluateCompatibilityByMission(fixtures.missionId);
    assignmentInspection.confirmAssignment({ missionId: fixtures.missionId });
    activationInspection.evaluateActivation({ missionId: fixtures.missionId, activationPolicyId: 'confirmed-assignment-default' });

    const executionContract = executionInspection.evaluateExecutionContract({
      missionId: fixtures.missionId,
      executionPolicyId: 'strict-runtime-handoff-default',
    });
    expect(executionContract.executionEligibilityState).toBe('waiting_on_runtime_preparation');

    const listedRuntime = runtimeInspection.listRuntimeEnvelopes();
    expect(listedRuntime).toHaveLength(1);

    const runtimeEnvelopeId = listedRuntime[0]?.runtimeEnvelopeId;
    if (!runtimeEnvelopeId) {
      throw new Error('RUNTIME_ENVELOPE_NOT_FOUND');
    }

    const evaluatedRuntime = runtimeInspection.evaluateRuntimeEnvelope({ runtimeEnvelopeId });
    expect(evaluatedRuntime.runtimeEnvelopeId).toBe(runtimeEnvelopeId);
    runtimeInspection.confirmRuntimeEnvelope({ runtimeEnvelopeId, reviewedBy: 'founder' });

    const firstAttempt = executionAttemptInspection.createExecutionAttempt({
      runtimeEnvelopeId,
      attemptIndex: 1,
    });

    const secondAttempt = executionAttemptInspection.createExecutionAttempt({
      runtimeEnvelopeId,
      attemptIndex: 1,
    });

    expect(firstAttempt.executionAttemptId).toBe(secondAttempt.executionAttemptId);
    expect(firstAttempt.executionContractId).toBe(executionContract.executionContractId);

    const evaluatedAttempt = executionAttemptInspection.evaluateExecutionAttempt({
      executionAttemptId: firstAttempt.executionAttemptId,
    });
    expect(evaluatedAttempt.attemptLifecycleState).toBe('prepared');

    const materializedFirst = executionAttemptInspection.materializeExecutionAttempt({
      executionAttemptId: firstAttempt.executionAttemptId,
    });
    const materializedSecond = executionAttemptInspection.materializeExecutionAttempt({
      executionAttemptId: firstAttempt.executionAttemptId,
    });

    expect(fs.existsSync(materializedFirst.statusPath)).toBe(true);
    expect(fs.existsSync(materializedFirst.reportPath)).toBe(true);
    expect(fs.existsSync(materializedFirst.markdownPath)).toBe(true);
    expect(fs.existsSync(materializedFirst.historyPath)).toBe(true);
    expect(fs.existsSync(materializedFirst.inputsPath)).toBe(true);
    expect(fs.existsSync(materializedFirst.capabilitiesPath)).toBe(true);

    const firstSnapshot = {
      status: fs.readFileSync(materializedFirst.statusPath, 'utf8'),
      report: fs.readFileSync(materializedFirst.reportPath, 'utf8'),
      markdown: fs.readFileSync(materializedFirst.markdownPath, 'utf8'),
      history: fs.readFileSync(materializedFirst.historyPath, 'utf8'),
      inputs: fs.readFileSync(materializedFirst.inputsPath, 'utf8'),
      capabilities: fs.readFileSync(materializedFirst.capabilitiesPath, 'utf8'),
    };

    const secondSnapshot = {
      status: fs.readFileSync(materializedSecond.statusPath, 'utf8'),
      report: fs.readFileSync(materializedSecond.reportPath, 'utf8'),
      markdown: fs.readFileSync(materializedSecond.markdownPath, 'utf8'),
      history: fs.readFileSync(materializedSecond.historyPath, 'utf8'),
      inputs: fs.readFileSync(materializedSecond.inputsPath, 'utf8'),
      capabilities: fs.readFileSync(materializedSecond.capabilitiesPath, 'utf8'),
    };

    expect(secondSnapshot).toEqual(firstSnapshot);

    const capabilities = JSON.parse(firstSnapshot.capabilities) as Record<string, boolean>;
    expect(Object.values(capabilities).every((value) => value === false)).toBe(true);

    const attemptReport = JSON.parse(firstSnapshot.report) as {
      attemptState: string;
      attemptLifecycleState: string;
    };
    expect(attemptReport.attemptState).toBe('waiting_on_runtime_support');
    expect(attemptReport.attemptLifecycleState).toBe('prepared');

    const missionAfter = fs.readFileSync(fixtures.missionFilePath, 'utf8');
    const teamAfter = fs.readFileSync(fixtures.teamFilePath, 'utf8');
    expect(missionAfter).toBe(missionBefore);
    expect(teamAfter).toBe(teamBefore);

    const files = fs.readdirSync(tmpRoot, { recursive: true }) as string[];
    expect(files.some((entry) => entry.includes('runs'))).toBe(false);
    expect(files.some((entry) => entry.includes('scheduler'))).toBe(false);
    expect(files.some((entry) => entry.includes('tasks'))).toBe(false);
  });
});
