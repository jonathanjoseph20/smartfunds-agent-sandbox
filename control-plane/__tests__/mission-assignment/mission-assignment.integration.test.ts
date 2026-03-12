import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { deriveMissionIdFromPayload } from '../../missions/mission-identity.ts';
import { createMissionAssignmentInspection } from '../../mission-assignment/mission-assignment-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-assignment-integration');

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
  missionId: string;
  missionFilePath: string;
  teamFilePath: string;
} {
  const missionDefinitionsDir = path.join(tmpRoot, 'missions', 'definitions');
  const missionInstancesDir = path.join(tmpRoot, 'missions', 'instances');
  const teamDefinitionsDir = path.join(tmpRoot, 'teams', 'definitions');
  const compatibilityArtifactsRoot = path.join(tmpRoot, 'artifacts', 'team-compatibility');
  const assignmentArtifactsRoot = path.join(tmpRoot, 'artifacts', 'mission-assignment');

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

  writeJson(path.join(teamDefinitionsDir, 'team-restricted.json'), {
    teamId: 'team-restricted',
    displayName: 'team-restricted',
    description: 'desc',
    teamType: 'engineering',
    purpose: 'purpose',
    domainTags: ['product'],
    supportedMissionTypes: ['generate-product-spec'],
    supportedTemplateIds: ['generate-product-spec'],
    capabilityTags: ['product_spec'],
    defaultOperatingMode: 'on_demand',
    lifecycleState: 'active',
    availabilityState: 'restricted',
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
    missionId,
    missionFilePath,
    teamFilePath,
  };
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission assignment integration', () => {
  it('T-MA-I1 evaluate -> inspect -> confirm -> override -> materialize is deterministic and pre-execution only', () => {
    const fixtures = seedFixtures();

    const inspection = createMissionAssignmentInspection({
      missionDefinitionsDir: fixtures.missionDefinitionsDir,
      missionInstancesDir: fixtures.missionInstancesDir,
      teamDefinitionsDir: fixtures.teamDefinitionsDir,
      compatibilityArtifactsRoot: fixtures.compatibilityArtifactsRoot,
      assignmentArtifactsRoot: fixtures.assignmentArtifactsRoot,
    });

    const missionBefore = fs.readFileSync(fixtures.missionFilePath, 'utf8');
    const teamBefore = fs.readFileSync(fixtures.teamFilePath, 'utf8');

    const first = inspection.evaluateAssignment({ missionId: fixtures.missionId });
    const second = inspection.evaluateAssignment({ missionId: fixtures.missionId });

    expect(first).toEqual(second);
    expect(first.assignmentDecisionId).toBe(second.assignmentDecisionId);

    const listed = inspection.listAssignments();
    expect(listed).toHaveLength(1);
    expect(listed[0].missionId).toBe(fixtures.missionId);

    const selected = inspection.getSelectedTeam({ missionId: fixtures.missionId });
    expect(selected).toBeDefined();

    const alternatives = inspection.getAlternativeTeams({ missionId: fixtures.missionId });
    expect(alternatives.length).toBeGreaterThanOrEqual(0);

    const confirmed = inspection.confirmAssignment({ missionId: fixtures.missionId });
    expect(confirmed.decisionState).toBe('confirmed');
    const confirmedDecisionId = confirmed.assignmentDecisionId;

    const overridden = inspection.overrideAssignment({
      missionId: fixtures.missionId,
      selectedTeamId: 'team-restricted',
      reason: 'founder strategic preference',
      reviewedBy: 'founder',
    });

    expect(overridden.assignmentMode).toBe('founder_override');
    expect(overridden.selectedTeamId).toBe('team-restricted');
    expect(overridden.assignmentDecisionId).not.toBe(confirmedDecisionId);

    const inspectedByMission = inspection.inspectAssignment({ missionId: fixtures.missionId });
    expect(inspectedByMission.assignmentDecisionId).toBe(overridden.assignmentDecisionId);
    expect(inspectedByMission.selectedTeamId).toBe('team-restricted');
    expect(inspectedByMission.assignmentMode).toBe('founder_override');

    const statusByMission = inspection.getAssignmentStatus({ missionId: fixtures.missionId }) as {
      assignmentDecisionId: string;
      selectedTeamId: string | null;
    };
    expect(statusByMission.assignmentDecisionId).toBe(overridden.assignmentDecisionId);
    expect(statusByMission.selectedTeamId).toBe('team-restricted');

    const historyByMission = inspection.getAssignmentHistory({ missionId: fixtures.missionId });
    expect(historyByMission.assignmentDecisionId).toBe(overridden.assignmentDecisionId);
    expect(historyByMission.entries.some((entry) => entry.eventType === 'assignment_overridden')).toBe(true);

    const materialized = inspection.materializeAssignment({ missionId: fixtures.missionId });
    expect(fs.existsSync(materialized.statusPath)).toBe(true);
    expect(fs.existsSync(materialized.reportPath)).toBe(true);
    expect(fs.existsSync(materialized.markdownPath)).toBe(true);
    expect(fs.existsSync(materialized.historyPath)).toBe(true);
    expect(fs.existsSync(materialized.candidatesPath)).toBe(true);
    expect(materialized.assignmentDecisionId).toBe(overridden.assignmentDecisionId);

    const missionAfter = fs.readFileSync(fixtures.missionFilePath, 'utf8');
    const teamAfter = fs.readFileSync(fixtures.teamFilePath, 'utf8');

    expect(missionAfter).toBe(missionBefore);
    expect(teamAfter).toBe(teamBefore);

    const missionParsed = JSON.parse(missionAfter) as { assignedTeamIds: string[]; lifecycleState: string };
    expect(missionParsed.assignedTeamIds).toEqual([]);
    expect(missionParsed.lifecycleState).toBe('draft');

    const files = fs.readdirSync(tmpRoot, { recursive: true }) as string[];
    expect(files.some((entry) => entry.includes('runs'))).toBe(false);
    expect(files.some((entry) => entry.includes('scheduler'))).toBe(false);
  });
});
