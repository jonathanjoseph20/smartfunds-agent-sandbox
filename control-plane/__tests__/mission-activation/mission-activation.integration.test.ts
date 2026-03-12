import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { deriveMissionIdFromPayload } from '../../missions/mission-identity.ts';
import { createMissionAssignmentInspection } from '../../mission-assignment/mission-assignment-inspection.ts';
import { createMissionActivationInspection } from '../../mission-activation/mission-activation-inspection.ts';
import { createTeamCompatibilityInspection } from '../../team-compatibility/team-compatibility-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-activation-integration');

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
    missionId,
    missionFilePath,
    teamFilePath,
  };
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission activation integration', () => {
  it('T-MACT-I1 end-to-end activation flow is deterministic and projection-only', () => {
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

    const missionBefore = fs.readFileSync(fixtures.missionFilePath, 'utf8');
    const teamBefore = fs.readFileSync(fixtures.teamFilePath, 'utf8');

    compatibilityInspection.evaluateCompatibilityByMission(fixtures.missionId);

    const assigned = assignmentInspection.confirmAssignment({ missionId: fixtures.missionId });
    expect(assigned.decisionState).toBe('confirmed');

    const assignmentBeforeActivation = assignmentInspection.inspectAssignment({ missionId: fixtures.missionId });

    const evaluated = activationInspection.evaluateActivation({
      missionId: fixtures.missionId,
      activationPolicyId: 'confirmed-assignment-default',
    });

    const evaluatedAgain = activationInspection.evaluateActivation({
      missionId: fixtures.missionId,
      activationPolicyId: 'confirmed-assignment-default',
    });

    expect(evaluated.activationDecisionId).toBe(evaluatedAgain.activationDecisionId);

    const confirmed = activationInspection.confirmActivation({
      missionId: fixtures.missionId,
      activationPolicyId: 'confirmed-assignment-default',
      reviewedBy: 'founder',
    });

    expect(confirmed.activationState).toBe('ready_for_activation');
    expect(confirmed.handoffContract.runtimeInvocationSupported).toBe(false);

    const inspected = activationInspection.inspectActivationDecision({
      missionId: fixtures.missionId,
      activationPolicyId: 'confirmed-assignment-default',
    });

    expect(inspected.activationDecisionId).toBe(confirmed.activationDecisionId);

    const materialized = activationInspection.materializeActivation({
      missionId: fixtures.missionId,
      activationPolicyId: 'confirmed-assignment-default',
    });

    expect(fs.existsSync(materialized.statusPath)).toBe(true);
    expect(fs.existsSync(materialized.reportPath)).toBe(true);
    expect(fs.existsSync(materialized.markdownPath)).toBe(true);
    expect(fs.existsSync(materialized.historyPath)).toBe(true);
    expect(fs.existsSync(materialized.preconditionsPath)).toBe(true);
    expect(fs.existsSync(materialized.handoffPath)).toBe(true);

    const assignmentAfterActivation = assignmentInspection.inspectAssignment({ missionId: fixtures.missionId });
    expect(assignmentAfterActivation).toEqual(assignmentBeforeActivation);

    const missionAfter = fs.readFileSync(fixtures.missionFilePath, 'utf8');
    const teamAfter = fs.readFileSync(fixtures.teamFilePath, 'utf8');
    expect(missionAfter).toBe(missionBefore);
    expect(teamAfter).toBe(teamBefore);

    const files = fs.readdirSync(tmpRoot, { recursive: true }) as string[];
    expect(files.some((entry) => entry.includes('runs'))).toBe(false);
    expect(files.some((entry) => entry.includes('scheduler'))).toBe(false);

    const handoff = JSON.parse(fs.readFileSync(materialized.handoffPath, 'utf8')) as {
      runtimeInvocationSupported: boolean;
    };
    expect(handoff.runtimeInvocationSupported).toBe(false);
  });
});
