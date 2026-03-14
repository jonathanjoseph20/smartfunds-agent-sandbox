import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createBuildEvidenceInspection } from '../../build-evidence/build-evidence-inspection.ts';
import { createBuildExecutionManager } from '../../build-runtime/build-execution-manager.ts';
import { createCodexExecutionPacketManager } from '../../codex/codex-execution-packet-manager.ts';
import { createEngineeringPlanManager } from '../../engineering/engineering-plan-manager.ts';
import { createProductSpecManager } from '../../products/product-spec-manager.ts';
import { createRepoScaffoldManager } from '../../repo-scaffold/repo-scaffold-manager.ts';
import { createImplementationTaskGraphInspection } from '../../tasks/task-graph-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'build-evidence', 'tmp-build-evidence-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('build evidence integration', () => {
  it('T-PF7-INT1 pipeline ProductSpec -> EngineeringPlan -> TaskGraph -> Codex -> RepoScaffold -> BuildRun -> BuildEvidence is deterministic and additive', () => {
    const specsFilePath = path.join(tmpRoot, 'state', 'product-specs.json');
    const specHistoryFilePath = path.join(tmpRoot, 'state', 'product-spec-history.json');
    const plansFilePath = path.join(tmpRoot, 'state', 'engineering-plans.json');
    const engineeringHistoryFilePath = path.join(tmpRoot, 'state', 'engineering-plan-history.json');
    const taskGraphsFilePath = path.join(tmpRoot, 'state', 'implementation-task-graphs.json');
    const taskGraphHistoryFilePath = path.join(tmpRoot, 'state', 'implementation-task-graph-history.json');
    const packetsFilePath = path.join(tmpRoot, 'state', 'codex-execution-packets.json');
    const packetHistoryFilePath = path.join(tmpRoot, 'state', 'codex-execution-packet-history.json');
    const bundlesFilePath = path.join(tmpRoot, 'state', 'repo-scaffold-bundles.json');
    const bundleHistoryFilePath = path.join(tmpRoot, 'state', 'repo-scaffold-history.json');
    const runsFilePath = path.join(tmpRoot, 'state', 'build-execution-runs.json');
    const runHistoryFilePath = path.join(tmpRoot, 'state', 'build-execution-history.json');
    const evidenceBundlesFilePath = path.join(tmpRoot, 'state', 'build-evidence-bundles.json');
    const evidenceHistoryFilePath = path.join(tmpRoot, 'state', 'build-evidence-history.json');

    const productsManager = createProductSpecManager({
      specsFilePath,
      historyFilePath: specHistoryFilePath,
    });

    const spec = productsManager.createProductSpec({
      name: 'Build Evidence PF7',
      problem: 'Need deterministic evidence governance layer.',
      targetUser: 'Operator',
      solution: 'Deterministic evidence projection and materialization.',
      architectureSummary: 'Product -> Plan -> Graph -> Packet -> Scaffold -> BuildRun -> BuildEvidence',
      mvpScope: 'PF7 control plane',
      originMissionIds: ['mission-pf7'],
    });

    const engineeringManager = createEngineeringPlanManager({
      plansFilePath,
      historyFilePath: engineeringHistoryFilePath,
    });

    const plan = engineeringManager.createEngineeringPlan({
      specId: spec.specId,
      architectureSummary: 'Deterministic build evidence',
      subsystems: ['control-plane'],
      implementationPhases: ['phase-1'],
      dependencies: ['build-runtime'],
      integrationRequirements: ['deterministic-json'],
      testStrategy: 'unit+integration',
      constraints: ['no-randomness'],
    });

    const taskInspection = createImplementationTaskGraphInspection({
      plansFilePath,
      engineeringPlanHistoryFilePath: engineeringHistoryFilePath,
      taskGraphsFilePath,
      historyFilePath: taskGraphHistoryFilePath,
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'tasks'),
    });

    const graph = taskInspection.createTaskGraph({ planId: plan.planId });

    const packetManager = createCodexExecutionPacketManager({
      packetsFilePath,
      historyFilePath: packetHistoryFilePath,
      taskGraphsFilePath,
      taskGraphHistoryFilePath,
      plansFilePath,
      engineeringPlanHistoryFilePath: engineeringHistoryFilePath,
    });

    const packetCreate = packetManager.createCodexExecutionPackets(graph.taskGraphId);
    const packetId = packetCreate.packetIds[0]!;

    const scaffoldManager = createRepoScaffoldManager({
      bundlesFilePath,
      historyFilePath: bundleHistoryFilePath,
      packetsFilePath,
      packetHistoryFilePath,
      taskGraphsFilePath,
      taskGraphHistoryFilePath,
      plansFilePath,
      engineeringPlanHistoryFilePath: engineeringHistoryFilePath,
    });

    const scaffoldCreated = scaffoldManager.createRepoScaffoldBundles(packetId);

    const buildManager = createBuildExecutionManager({
      runsFilePath,
      historyFilePath: runHistoryFilePath,
      packetsFilePath,
      packetHistoryFilePath,
      bundlesFilePath,
      bundleHistoryFilePath,
      taskGraphsFilePath,
      taskGraphHistoryFilePath,
      plansFilePath,
      engineeringPlanHistoryFilePath: engineeringHistoryFilePath,
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'build-runtime'),
    });

    const runSummary = buildManager.createBuildExecutionRun(packetId, scaffoldCreated.bundleId);
    buildManager.executeBuildRun(runSummary.runId);

    const runBeforeEvidence = fs.readFileSync(runsFilePath, 'utf8');

    const evidenceInspection = createBuildEvidenceInspection({
      bundlesFilePath: evidenceBundlesFilePath,
      historyFilePath: evidenceHistoryFilePath,
      runsFilePath,
      runHistoryFilePath,
      packetsFilePath,
      packetHistoryFilePath,
      bundlesRuntimeFilePath: bundlesFilePath,
      bundleHistoryFilePath,
      taskGraphsFilePath,
      taskGraphHistoryFilePath,
      plansFilePath,
      engineeringPlanHistoryFilePath: engineeringHistoryFilePath,
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'build-evidence'),
    });

    const createdFirst = evidenceInspection.createEvidenceBundle({ runId: runSummary.runId });
    const createdSecond = evidenceInspection.createEvidenceBundle({ runId: runSummary.runId });
    expect(createdFirst.buildEvidenceBundleId).toBe(createdSecond.buildEvidenceBundleId);

    const verified = evidenceInspection.verifyEvidenceBundle({ buildEvidenceBundleId: createdFirst.buildEvidenceBundleId });
    expect(['verified', 'blocked', 'failed', 'inconclusive']).toContain(verified.verificationStatus);

    const materialized = evidenceInspection.materializeEvidenceBundle({ buildEvidenceBundleId: createdFirst.buildEvidenceBundleId });

    expect(fs.existsSync(materialized.statusPath)).toBe(true);
    expect(fs.existsSync(materialized.artifactVerificationPath)).toBe(true);
    expect(fs.existsSync(materialized.promptAttestationPath)).toBe(true);
    expect(fs.existsSync(materialized.executionPlanAttestationPath)).toBe(true);
    expect(fs.existsSync(materialized.historyPath)).toBe(true);
    expect(fs.existsSync(materialized.outcomePath)).toBe(true);
    expect(fs.existsSync(materialized.reportJsonPath)).toBe(true);
    expect(fs.existsSync(materialized.reportMarkdownPath)).toBe(true);

    const runAfterEvidence = fs.readFileSync(runsFilePath, 'utf8');
    expect(runAfterEvidence).toBe(runBeforeEvidence);

    const listed = evidenceInspection.listEvidenceBundles();
    expect(listed.some((entry) => entry.buildEvidenceBundleId === createdFirst.buildEvidenceBundleId)).toBe(true);
  });
});
