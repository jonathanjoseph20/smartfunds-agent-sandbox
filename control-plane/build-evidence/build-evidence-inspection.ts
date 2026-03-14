import {
  createBuildEvidenceManager,
  type BuildEvidenceManager,
} from './build-evidence-manager.ts';
import {
  createBuildEvidenceMaterializer,
  type BuildEvidenceMaterializer,
} from './build-evidence-materializer.ts';

export function createBuildEvidenceInspection(options: {
  manager?: BuildEvidenceManager;
  materializer?: BuildEvidenceMaterializer;
  bundlesFilePath?: string;
  historyFilePath?: string;
  runsFilePath?: string;
  runHistoryFilePath?: string;
  packetsFilePath?: string;
  packetHistoryFilePath?: string;
  bundlesRuntimeFilePath?: string;
  bundleHistoryFilePath?: string;
  taskGraphsFilePath?: string;
  taskGraphHistoryFilePath?: string;
  plansFilePath?: string;
  engineeringPlanHistoryFilePath?: string;
  artifactsRoot?: string;
} = {}) {
  const manager = options.manager ?? createBuildEvidenceManager({
    bundlesFilePath: options.bundlesFilePath,
    historyFilePath: options.historyFilePath,
    runsFilePath: options.runsFilePath,
    runHistoryFilePath: options.runHistoryFilePath,
    packetsFilePath: options.packetsFilePath,
    packetHistoryFilePath: options.packetHistoryFilePath,
    bundlesRuntimeFilePath: options.bundlesRuntimeFilePath,
    bundleHistoryFilePath: options.bundleHistoryFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  const materializer = options.materializer ?? createBuildEvidenceMaterializer({
    manager,
    artifactsRoot: options.artifactsRoot,
    bundlesFilePath: options.bundlesFilePath,
    historyFilePath: options.historyFilePath,
    runsFilePath: options.runsFilePath,
    runHistoryFilePath: options.runHistoryFilePath,
    packetsFilePath: options.packetsFilePath,
    packetHistoryFilePath: options.packetHistoryFilePath,
    bundlesRuntimeFilePath: options.bundlesRuntimeFilePath,
    bundleHistoryFilePath: options.bundleHistoryFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  function listEvidenceBundles() {
    return manager.listBuildEvidenceProjections();
  }

  function inspectEvidenceBundle(buildEvidenceBundleId: string) {
    return manager.deriveBuildEvidenceProjection(buildEvidenceBundleId);
  }

  function inspectArtifactVerification(buildEvidenceBundleId: string) {
    return manager.deriveBuildEvidenceProjection(buildEvidenceBundleId).artifactVerificationSummaries;
  }

  function inspectPromptAttestation(buildEvidenceBundleId: string) {
    return manager.deriveBuildEvidenceProjection(buildEvidenceBundleId).promptAttestationSummary;
  }

  function inspectExecutionPlanAttestation(buildEvidenceBundleId: string) {
    return manager.deriveBuildEvidenceProjection(buildEvidenceBundleId).executionPlanAttestationSummary;
  }

  function inspectGovernanceValidation(buildEvidenceBundleId: string) {
    const projection = manager.deriveBuildEvidenceProjection(buildEvidenceBundleId);
    return {
      buildEvidenceBundleId: projection.buildEvidenceBundleId,
      runId: projection.runId,
      governanceValidation: projection.governanceValidation,
      verificationStatus: projection.verificationStatus,
    };
  }

  function inspectEvidenceHistory(buildEvidenceBundleId: string) {
    return manager.historyStore.listBuildEvidenceEvents(buildEvidenceBundleId);
  }

  function inspectEvidenceOutcome(buildEvidenceBundleId: string) {
    const projection = manager.deriveBuildEvidenceProjection(buildEvidenceBundleId);
    return {
      buildEvidenceBundleId: projection.buildEvidenceBundleId,
      runId: projection.runId,
      outcome: projection.outcome,
    };
  }

  function createEvidenceBundle(input: { runId: string }) {
    return manager.createBuildEvidenceBundle(input.runId);
  }

  function verifyEvidenceBundle(input: { buildEvidenceBundleId: string }) {
    return manager.verifyBuildEvidenceBundle(input.buildEvidenceBundleId);
  }

  function materializeEvidenceBundle(input: { buildEvidenceBundleId: string }) {
    return materializer.materializeBuildEvidenceBundle(input.buildEvidenceBundleId);
  }

  return {
    listEvidenceBundles,
    inspectEvidenceBundle,
    inspectArtifactVerification,
    inspectPromptAttestation,
    inspectExecutionPlanAttestation,
    inspectGovernanceValidation,
    inspectEvidenceHistory,
    inspectEvidenceOutcome,
    createEvidenceBundle,
    verifyEvidenceBundle,
    materializeEvidenceBundle,
  };
}

export type BuildEvidenceInspection = ReturnType<typeof createBuildEvidenceInspection>;
