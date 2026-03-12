import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { deriveMissionIdFromPayload } from '../../missions/mission-identity.ts';
import { createTeamCompatibilityInspection } from '../../team-compatibility/team-compatibility-inspection.ts';
import { createMissionAssignmentInspection } from '../../mission-assignment/mission-assignment-inspection.ts';
import { createMissionActivationInspection } from '../../mission-activation/mission-activation-inspection.ts';
import { createExecutionContractInspection } from '../../execution-contract/execution-contract-inspection.ts';
import { createRuntimeEnvelopeInspection } from '../../runtime-envelope/runtime-envelope-inspection.ts';
import { createExecutionAttemptInspection } from '../../execution-attempt/execution-attempt-inspection.ts';
import { createExecutionJournalInspection } from '../../execution-journal/execution-journal-inspection.ts';
import { createExecutionEngineInspection } from '../../execution-engine/execution-engine-inspection.ts';
import { createTaskGraphInspection } from '../../task-graph/task-graph-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-task-graph-integration');

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
  const executionJournalArtifactsRoot = path.join(tmpRoot, 'artifacts', 'execution-journal');
  const executionEngineArtifactsRoot = path.join(tmpRoot, 'artifacts', 'execution-engine');
  const taskGraphArtifactsRoot = path.join(tmpRoot, 'artifacts', 'task-graph');

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
    executionJournalArtifactsRoot,
    executionEngineArtifactsRoot,
    taskGraphArtifactsRoot,
    missionId,
    missionFilePath,
    teamFilePath,
  };
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('task graph integration', () => {
  it('T-MTG-I1 deterministic full pipeline through task graph with no upstream mutation', () => {
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

    const journalInspection = createExecutionJournalInspection({
      missionDefinitionsDir: fixtures.missionDefinitionsDir,
      missionInstancesDir: fixtures.missionInstancesDir,
      teamDefinitionsDir: fixtures.teamDefinitionsDir,
      compatibilityArtifactsRoot: fixtures.compatibilityArtifactsRoot,
      assignmentArtifactsRoot: fixtures.assignmentArtifactsRoot,
      activationArtifactsRoot: fixtures.activationArtifactsRoot,
      executionContractArtifactsRoot: fixtures.executionContractArtifactsRoot,
      runtimeEnvelopeArtifactsRoot: fixtures.runtimeEnvelopeArtifactsRoot,
      executionAttemptArtifactsRoot: fixtures.executionAttemptArtifactsRoot,
      executionJournalArtifactsRoot: fixtures.executionJournalArtifactsRoot,
    });

    const engineInspection = createExecutionEngineInspection({
      missionDefinitionsDir: fixtures.missionDefinitionsDir,
      missionInstancesDir: fixtures.missionInstancesDir,
      teamDefinitionsDir: fixtures.teamDefinitionsDir,
      compatibilityArtifactsRoot: fixtures.compatibilityArtifactsRoot,
      assignmentArtifactsRoot: fixtures.assignmentArtifactsRoot,
      activationArtifactsRoot: fixtures.activationArtifactsRoot,
      executionContractArtifactsRoot: fixtures.executionContractArtifactsRoot,
      runtimeEnvelopeArtifactsRoot: fixtures.runtimeEnvelopeArtifactsRoot,
      executionAttemptArtifactsRoot: fixtures.executionAttemptArtifactsRoot,
      executionJournalArtifactsRoot: fixtures.executionJournalArtifactsRoot,
      executionEngineArtifactsRoot: fixtures.executionEngineArtifactsRoot,
    });

    const taskGraphInspection = createTaskGraphInspection({
      missionDefinitionsDir: fixtures.missionDefinitionsDir,
      missionInstancesDir: fixtures.missionInstancesDir,
      teamDefinitionsDir: fixtures.teamDefinitionsDir,
      compatibilityArtifactsRoot: fixtures.compatibilityArtifactsRoot,
      assignmentArtifactsRoot: fixtures.assignmentArtifactsRoot,
      activationArtifactsRoot: fixtures.activationArtifactsRoot,
      executionContractArtifactsRoot: fixtures.executionContractArtifactsRoot,
      runtimeEnvelopeArtifactsRoot: fixtures.runtimeEnvelopeArtifactsRoot,
      executionAttemptArtifactsRoot: fixtures.executionAttemptArtifactsRoot,
      executionJournalArtifactsRoot: fixtures.executionJournalArtifactsRoot,
      executionEngineArtifactsRoot: fixtures.executionEngineArtifactsRoot,
      taskGraphArtifactsRoot: fixtures.taskGraphArtifactsRoot,
    });

    const missionBefore = fs.readFileSync(fixtures.missionFilePath, 'utf8');
    const teamBefore = fs.readFileSync(fixtures.teamFilePath, 'utf8');

    compatibilityInspection.evaluateCompatibilityByMission(fixtures.missionId);
    assignmentInspection.confirmAssignment({ missionId: fixtures.missionId });
    activationInspection.evaluateActivation({ missionId: fixtures.missionId, activationPolicyId: 'confirmed-assignment-default' });

    executionInspection.evaluateExecutionContract({
      missionId: fixtures.missionId,
      executionPolicyId: 'strict-runtime-handoff-default',
    });
    executionInspection.confirmExecutionContract({
      missionId: fixtures.missionId,
      reviewedBy: 'founder',
      executionPolicyId: 'strict-runtime-handoff-default',
    });

    const runtimeEnvelopeId = runtimeInspection.listRuntimeEnvelopes()[0]?.runtimeEnvelopeId;
    if (!runtimeEnvelopeId) {
      throw new Error('RUNTIME_ENVELOPE_NOT_FOUND');
    }

    runtimeInspection.confirmRuntimeEnvelope({ runtimeEnvelopeId, reviewedBy: 'founder' });

    const attempt = executionAttemptInspection.createExecutionAttempt({ runtimeEnvelopeId, attemptIndex: 1 });
    executionAttemptInspection.evaluateExecutionAttempt({ executionAttemptId: attempt.executionAttemptId });
    journalInspection.evaluateExecutionJournal({ executionAttemptId: attempt.executionAttemptId });

    const engineFirst = engineInspection.evaluateEngineReadiness({ executionAttemptId: attempt.executionAttemptId });
    const engineSecond = engineInspection.evaluateEngineReadiness({ executionAttemptId: attempt.executionAttemptId });
    expect(engineFirst.executionEngineRunId).toBe(engineSecond.executionEngineRunId);

    const graphFirst = taskGraphInspection.evaluateTaskGraph({ executionEngineRunId: engineFirst.executionEngineRunId });
    const graphSecond = taskGraphInspection.evaluateTaskGraph({ executionEngineRunId: engineFirst.executionEngineRunId });

    expect(graphFirst.taskGraphId).toBe(graphSecond.taskGraphId);
    expect(graphFirst.taskNodes.map((node) => node.taskNodeId)).toEqual([...graphFirst.taskNodes.map((node) => node.taskNodeId)].sort((a, b) => a.localeCompare(b)));

    const materializedFirst = taskGraphInspection.materializeTaskGraph({ taskGraphId: graphFirst.taskGraphId });
    const materializedSecond = taskGraphInspection.materializeTaskGraph({ taskGraphId: graphFirst.taskGraphId });

    const firstSnapshot = {
      status: fs.readFileSync(materializedFirst.statusPath, 'utf8'),
      report: fs.readFileSync(materializedFirst.reportPath, 'utf8'),
      markdown: fs.readFileSync(materializedFirst.markdownPath, 'utf8'),
      history: fs.readFileSync(materializedFirst.historyPath, 'utf8'),
      nodes: fs.readFileSync(materializedFirst.nodesPath, 'utf8'),
      edges: fs.readFileSync(materializedFirst.edgesPath, 'utf8'),
    };

    const secondSnapshot = {
      status: fs.readFileSync(materializedSecond.statusPath, 'utf8'),
      report: fs.readFileSync(materializedSecond.reportPath, 'utf8'),
      markdown: fs.readFileSync(materializedSecond.markdownPath, 'utf8'),
      history: fs.readFileSync(materializedSecond.historyPath, 'utf8'),
      nodes: fs.readFileSync(materializedSecond.nodesPath, 'utf8'),
      edges: fs.readFileSync(materializedSecond.edgesPath, 'utf8'),
    };

    expect(secondSnapshot).toEqual(firstSnapshot);

    const missionAfter = fs.readFileSync(fixtures.missionFilePath, 'utf8');
    const teamAfter = fs.readFileSync(fixtures.teamFilePath, 'utf8');
    expect(missionAfter).toBe(missionBefore);
    expect(teamAfter).toBe(teamBefore);
  });
});
