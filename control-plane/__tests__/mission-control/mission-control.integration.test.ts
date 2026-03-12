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
import { createTaskExecutionInspection } from '../../task-execution/task-execution-inspection.ts';
import { createMissionRunInspection } from '../../mission-control/mission-run-inspection.ts';
import { createMissionRunMaterializer } from '../../mission-control/mission-run-materializer.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-control-integration');

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
  const taskExecutionArtifactsRoot = path.join(tmpRoot, 'artifacts', 'task-execution');
  const missionControlArtifactsRoot = path.join(tmpRoot, 'artifacts', 'mission-control');

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
    requestedDeliverables: [{ deliverableId: 'product_spec' }, { deliverableId: 'mvp_scope' }],
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
    taskExecutionArtifactsRoot,
    missionControlArtifactsRoot,
    missionId,
    missionFilePath,
    teamFilePath,
  };
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission control integration', () => {
  it('T-MC-IN1 derives deterministic mission run projection and materialization from runtime chain', () => {
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
    const taskExecutionInspection = createTaskExecutionInspection({
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
      taskExecutionArtifactsRoot: fixtures.taskExecutionArtifactsRoot,
    });

    const missionControlInspection = createMissionRunInspection({
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
      taskExecutionArtifactsRoot: fixtures.taskExecutionArtifactsRoot,
      missionControlArtifactsRoot: fixtures.missionControlArtifactsRoot,
    });

    const missionControlMaterializer = createMissionRunMaterializer({
      inspection: missionControlInspection,
      missionControlArtifactsRoot: fixtures.missionControlArtifactsRoot,
    });

    const missionBefore = fs.readFileSync(fixtures.missionFilePath, 'utf8');
    const teamBefore = fs.readFileSync(fixtures.teamFilePath, 'utf8');

    compatibilityInspection.evaluateCompatibilityByMission(fixtures.missionId);
    assignmentInspection.confirmAssignment({ missionId: fixtures.missionId });
    activationInspection.evaluateActivation({ missionId: fixtures.missionId, activationPolicyId: 'confirmed-assignment-default' });
    executionInspection.evaluateExecutionContract({ missionId: fixtures.missionId, executionPolicyId: 'strict-runtime-handoff-default' });
    executionInspection.confirmExecutionContract({ missionId: fixtures.missionId, reviewedBy: 'founder', executionPolicyId: 'strict-runtime-handoff-default' });

    const runtimeEnvelopeId = runtimeInspection.listRuntimeEnvelopes()[0]?.runtimeEnvelopeId;
    if (!runtimeEnvelopeId) {
      throw new Error('RUNTIME_ENVELOPE_NOT_FOUND');
    }

    runtimeInspection.confirmRuntimeEnvelope({ runtimeEnvelopeId, reviewedBy: 'founder' });

    const attempt = executionAttemptInspection.createExecutionAttempt({ runtimeEnvelopeId, attemptIndex: 1 });
    executionAttemptInspection.evaluateExecutionAttempt({ executionAttemptId: attempt.executionAttemptId });
    journalInspection.evaluateExecutionJournal({ executionAttemptId: attempt.executionAttemptId });

    const engine = engineInspection.evaluateEngineReadiness({ executionAttemptId: attempt.executionAttemptId });
    const graph = taskGraphInspection.evaluateTaskGraph({ executionEngineRunId: engine.executionEngineRunId });

    let executionProjection = taskExecutionInspection.inspectTaskExecutionRun({ taskGraphId: graph.taskGraphId });
    let failureNodeId = Object.entries(executionProjection.nodeStates)
      .find(([, state]) => state === 'ready' || state === 'running')?.[0];

    if (!failureNodeId) {
      taskExecutionInspection.stepTaskExecution({ taskGraphId: graph.taskGraphId });
      executionProjection = taskExecutionInspection.inspectTaskExecutionRun({ taskGraphId: graph.taskGraphId });
      failureNodeId = Object.entries(executionProjection.nodeStates)
        .find(([, state]) => state === 'ready' || state === 'running')?.[0];
    }

    if (!failureNodeId) {
      throw new Error('TASK_NODE_NOT_READY');
    }

    taskExecutionInspection.failTaskNode({
      taskGraphId: graph.taskGraphId,
      taskNodeId: failureNodeId,
      failureClass: 'NON_RETRYABLE_FAILURE',
    });

    const runs = missionControlInspection.listMissionRuns();
    expect(runs).toHaveLength(1);

    const missionRunId = runs[0]?.missionRunId;
    if (!missionRunId) {
      throw new Error('MISSION_RUN_NOT_FOUND');
    }

    const firstProjection = missionControlInspection.inspectMissionRun({ missionRunId });
    const secondProjection = missionControlInspection.inspectMissionRun({ missionRunId });

    expect(secondProjection).toEqual(firstProjection);
    expect(firstProjection.operationalState).toBe('failed');
    expect(firstProjection.escalations.map((entry) => entry.escalationClass)).toContain('terminal_node_failure');

    const firstMaterialized = missionControlMaterializer.materializeOne({ missionRunId });
    const secondMaterialized = missionControlMaterializer.materializeOne({ missionRunId });

    const firstSnapshot = {
      status: fs.readFileSync(firstMaterialized.statusPath, 'utf8'),
      progress: fs.readFileSync(firstMaterialized.progressPath, 'utf8'),
      report: fs.readFileSync(firstMaterialized.reportPath, 'utf8'),
      markdown: fs.readFileSync(firstMaterialized.markdownPath, 'utf8'),
      history: fs.readFileSync(firstMaterialized.historyPath, 'utf8'),
      escalations: fs.readFileSync(firstMaterialized.escalationsPath, 'utf8'),
      health: fs.readFileSync(firstMaterialized.healthPath, 'utf8'),
    };

    const secondSnapshot = {
      status: fs.readFileSync(secondMaterialized.statusPath, 'utf8'),
      progress: fs.readFileSync(secondMaterialized.progressPath, 'utf8'),
      report: fs.readFileSync(secondMaterialized.reportPath, 'utf8'),
      markdown: fs.readFileSync(secondMaterialized.markdownPath, 'utf8'),
      history: fs.readFileSync(secondMaterialized.historyPath, 'utf8'),
      escalations: fs.readFileSync(secondMaterialized.escalationsPath, 'utf8'),
      health: fs.readFileSync(secondMaterialized.healthPath, 'utf8'),
    };

    expect(secondSnapshot).toEqual(firstSnapshot);

    const history = missionControlInspection.inspectMissionHistory({ missionRunId });
    expect(new Set(history.entries.map((entry) => entry.eventDedupeKey)).size).toBe(history.entries.length);

    const missionAfter = fs.readFileSync(fixtures.missionFilePath, 'utf8');
    const teamAfter = fs.readFileSync(fixtures.teamFilePath, 'utf8');

    expect(missionAfter).toBe(missionBefore);
    expect(teamAfter).toBe(teamBefore);
  });
});
