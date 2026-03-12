import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { deriveMissionIdFromPayload } from '../../missions/mission-identity.ts';
import { createMissionActivationInspection } from '../../mission-activation/mission-activation-inspection.ts';
import { createMissionAssignmentInspection } from '../../mission-assignment/mission-assignment-inspection.ts';
import { createTeamCompatibilityInspection } from '../../team-compatibility/team-compatibility-inspection.ts';
import { createExecutionContractInspection } from '../../execution-contract/execution-contract-inspection.ts';
import { createRuntimeEnvelopeInspection } from '../../runtime-envelope/runtime-envelope-inspection.ts';
import { createExecutionAttemptHistoryStore } from '../../execution-attempt/execution-attempt-history-store.ts';
import { createExecutionAttemptMaterializer } from '../../execution-attempt/execution-attempt-materializer.ts';
import { createExecutionAttemptProjection } from '../../execution-attempt/execution-attempt-projection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-execution-attempt-materializer');

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
    displayName: 'generate-product-spec',
    enabled: true,
    description: 'desc',
    defaultObjective: 'objective',
    defaultDeliverables: ['product_spec'],
    allowedSourceKinds: ['memo'],
    defaultPriority: 'normal',
    defaultLifecycleState: 'draft',
    tags: ['product'],
  });

  const missionId = deriveMissionIdFromPayload({
    missionType: 'generate-product-spec',
    objective: 'objective',
    requestedDeliverables: [{ deliverableId: 'product_spec' }],
    sourceReferences: [{ sourceKind: 'memo', sourceId: 'memo-1', reference: 'memo://1' }],
    linkedActionPlanIds: [],
    founderInstructions: 'none',
    createdFrom: { kind: 'founder_directive' },
  });

  writeJson(path.join(missionInstancesDir, `${missionId}.json`), {
    missionId,
    missionType: 'generate-product-spec',
    displayName: 'Mission',
    objective: 'objective',
    founderInstructions: 'none',
    requestedDeliverables: [{ deliverableId: 'product_spec' }],
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

  writeJson(path.join(teamDefinitionsDir, 'team-a.json'), {
    teamId: 'team-a',
    displayName: 'team-a',
    description: 'desc',
    teamType: 'engineering',
    purpose: 'purpose',
    domainTags: ['product'],
    supportedMissionTypes: ['generate-product-spec'],
    supportedTemplateIds: ['generate-product-spec'],
    capabilityTags: ['product_spec'],
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
  };
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('execution attempt materializer', () => {
  it('T-MEA-M1 writes deterministic artifact set and preserves disabled execution semantics', () => {
    const fixtures = seedFixtures();

    createTeamCompatibilityInspection({
      missionDefinitionsDir: fixtures.missionDefinitionsDir,
      missionInstancesDir: fixtures.missionInstancesDir,
      teamDefinitionsDir: fixtures.teamDefinitionsDir,
      compatibilityArtifactsRoot: fixtures.compatibilityArtifactsRoot,
    }).evaluateCompatibilityByMission(fixtures.missionId);

    createMissionAssignmentInspection({
      missionDefinitionsDir: fixtures.missionDefinitionsDir,
      missionInstancesDir: fixtures.missionInstancesDir,
      teamDefinitionsDir: fixtures.teamDefinitionsDir,
      compatibilityArtifactsRoot: fixtures.compatibilityArtifactsRoot,
      assignmentArtifactsRoot: fixtures.assignmentArtifactsRoot,
    }).confirmAssignment({ missionId: fixtures.missionId });

    createMissionActivationInspection({
      missionDefinitionsDir: fixtures.missionDefinitionsDir,
      missionInstancesDir: fixtures.missionInstancesDir,
      teamDefinitionsDir: fixtures.teamDefinitionsDir,
      compatibilityArtifactsRoot: fixtures.compatibilityArtifactsRoot,
      assignmentArtifactsRoot: fixtures.assignmentArtifactsRoot,
      activationArtifactsRoot: fixtures.activationArtifactsRoot,
    }).evaluateActivation({ missionId: fixtures.missionId, activationPolicyId: 'confirmed-assignment-default' });

    createExecutionContractInspection({
      missionDefinitionsDir: fixtures.missionDefinitionsDir,
      missionInstancesDir: fixtures.missionInstancesDir,
      teamDefinitionsDir: fixtures.teamDefinitionsDir,
      compatibilityArtifactsRoot: fixtures.compatibilityArtifactsRoot,
      assignmentArtifactsRoot: fixtures.assignmentArtifactsRoot,
      activationArtifactsRoot: fixtures.activationArtifactsRoot,
      executionContractArtifactsRoot: fixtures.executionContractArtifactsRoot,
    }).evaluateExecutionContract({ missionId: fixtures.missionId, executionPolicyId: 'strict-runtime-handoff-default' });

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

    const runtimeEnvelopeId = runtimeInspection.listRuntimeEnvelopes()[0]?.runtimeEnvelopeId;
    if (!runtimeEnvelopeId) {
      throw new Error('RUNTIME_ENVELOPE_NOT_FOUND');
    }

    const runtimeEnvelope = runtimeInspection.evaluateRuntimeEnvelope({ runtimeEnvelopeId });

    const historyStore = createExecutionAttemptHistoryStore({ artifactsRoot: fixtures.executionAttemptArtifactsRoot });
    const projection = createExecutionAttemptProjection({
      historyStore,
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

    const evaluated = projection.projectOne({ runtimeEnvelopeId: runtimeEnvelope.runtimeEnvelopeId, attemptIndex: 1 });

    historyStore.append({
      executionAttemptId: evaluated.executionAttemptId,
      runtimeEnvelopeId: evaluated.runtimeEnvelopeId,
      executionContractId: evaluated.executionContractId,
      missionId: evaluated.missionId,
      eventType: 'execution_attempt_created',
      reasoning: 'execution_attempt_created',
      payload: {
        executionAttemptId: evaluated.executionAttemptId,
        runtimeEnvelopeId: evaluated.runtimeEnvelopeId,
        executionContractId: evaluated.executionContractId,
        missionId: evaluated.missionId,
        attemptIndex: evaluated.attemptIndex,
        attemptInputs: evaluated.attemptInputs,
      },
    });

    const materializer = createExecutionAttemptMaterializer({
      projection,
      historyStore,
      executionAttemptArtifactsRoot: fixtures.executionAttemptArtifactsRoot,
    });

    const first = materializer.materializeOne({ executionAttemptId: evaluated.executionAttemptId });
    const firstSnapshot = {
      status: fs.readFileSync(first.statusPath, 'utf8'),
      report: fs.readFileSync(first.reportPath, 'utf8'),
      markdown: fs.readFileSync(first.markdownPath, 'utf8'),
      history: fs.readFileSync(first.historyPath, 'utf8'),
      inputs: fs.readFileSync(first.inputsPath, 'utf8'),
      capabilities: fs.readFileSync(first.capabilitiesPath, 'utf8'),
    };

    const second = materializer.materializeOne({ executionAttemptId: evaluated.executionAttemptId });
    const secondSnapshot = {
      status: fs.readFileSync(second.statusPath, 'utf8'),
      report: fs.readFileSync(second.reportPath, 'utf8'),
      markdown: fs.readFileSync(second.markdownPath, 'utf8'),
      history: fs.readFileSync(second.historyPath, 'utf8'),
      inputs: fs.readFileSync(second.inputsPath, 'utf8'),
      capabilities: fs.readFileSync(second.capabilitiesPath, 'utf8'),
    };

    expect(secondSnapshot).toEqual(firstSnapshot);
    expect(firstSnapshot.markdown).toContain('# Mission Execution Attempt Report');

    const capabilities = JSON.parse(firstSnapshot.capabilities) as Record<string, boolean>;
    expect(Object.values(capabilities).every((value) => value === false)).toBe(true);

    const inputs = JSON.parse(firstSnapshot.inputs) as { targetRuntimeKind: string };
    expect(inputs.targetRuntimeKind).toBe('team_runtime');
  });
});
