import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';
import {
  createBuildEvidenceManager,
  type BuildEvidenceManager,
} from '../build-evidence/build-evidence-manager.ts';
import {
  createBuildExecutionManager,
  type BuildExecutionManager,
} from '../build-runtime/build-execution-manager.ts';
import {
  createCodexExecutionPacketManager,
  type CodexExecutionPacketManager,
} from '../codex/codex-execution-packet-manager.ts';
import {
  createCommerceManager,
  type CommerceManager,
} from '../commerce/commerce-manager.ts';
import {
  createEngineeringPlanManager,
  type EngineeringPlanManager,
} from '../engineering/engineering-plan-manager.ts';
import {
  createProductSpecManager,
  type ProductSpecManager,
} from '../products/product-spec-manager.ts';
import {
  createRepoScaffoldManager,
  type RepoScaffoldManager,
} from '../repo-scaffold/repo-scaffold-manager.ts';
import {
  createImplementationTaskGraphManager,
  type ImplementationTaskGraphManager,
} from '../tasks/task-graph-manager.ts';

import {
  createProductFactoryReleaseAcceptanceRecord,
} from './product-factory-release-acceptance-record.ts';
import {
  deriveProductFactoryReleaseAcceptanceRecordId,
} from './product-factory-release-acceptance-identity.ts';
import {
  PRODUCT_FACTORY_RELEASE_REQUIRED_DOCUMENT_IDS,
  type ProductFactoryReleaseAcceptanceRecord,
  type ProductFactoryReleaseCreateSummary,
  type ProductFactoryReleaseHistoryEvent,
  type ProductFactoryReleaseLayerSummary,
  type ProductFactoryReleaseProjection,
} from './product-factory-release-acceptance-types.ts';
import {
  createProductFactoryReleaseHistoryStore,
  toProductFactoryReleasePayloadHash,
  type ProductFactoryReleaseHistoryStore,
} from './product-factory-release-history-store.ts';
import {
  deriveProductFactoryReleaseProjectionEvents,
  projectProductFactoryRelease,
} from './product-factory-release-projection.ts';
import type { ReplayCheck } from './product-factory-replay-validation.ts';

const DEFAULT_PRODUCT_FACTORY_RELEASE_RECORDS_FILE = path.join(
  'runtime-data',
  'product-factory-release',
  'product-factory-release-acceptance-records.json',
);

type ProductFactoryReleaseStore = {
  records: ProductFactoryReleaseAcceptanceRecord[];
};

type ProductFactoryReleaseUpstreamContext = {
  ids: {
    productSpecId: string;
    planId: string;
    taskGraphId: string;
    packetId: string;
    bundleId: string;
    runId: string;
    buildEvidenceBundleId: string;
    chargeIntentId: string;
  };
  summaries: {
    productSpec: {
      status: string;
      validationState: string;
    };
    engineeringPlan: {
      status: string;
      validationState: string;
    };
    taskGraph: {
      status: string;
      planValidationState: string;
    };
    codexPacket: {
      status: string;
      validationState: string;
    };
    repoScaffold: {
      status: string;
      validationState: string;
    };
    buildRun: {
      status: string;
      validationState: string;
    };
    buildEvidence: {
      verificationStatus: string;
      governanceValidation: string;
      outcome: string;
    };
    commerceIntent: {
      status: string;
      outcome: string;
    };
  };
  replayChecks: ReplayCheck[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim().replace(/\\/g, '/')).filter((entry) => entry.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

function parseReleaseRecord(value: unknown): ProductFactoryReleaseAcceptanceRecord {
  if (!isRecord(value)) {
    throw new Error('PRODUCT_FACTORY_RELEASE_INVALID_RECORD');
  }

  const productFactoryReleaseAcceptanceRecordId = asString(value.productFactoryReleaseAcceptanceRecordId);
  const releaseTrack = asString(value.releaseTrack);
  const lifecycleAcceptanceId = asString(value.lifecycleAcceptanceId);
  const replayValidationId = asString(value.replayValidationId);
  const docsCompletenessId = asString(value.docsCompletenessId);
  const releaseHardeningId = asString(value.releaseHardeningId);
  const status = asString(value.status);
  const outcome = asString(value.outcome);

  if (
    !productFactoryReleaseAcceptanceRecordId
    || !releaseTrack
    || !lifecycleAcceptanceId
    || !replayValidationId
    || !docsCompletenessId
    || !releaseHardeningId
    || !status
    || !outcome
    || !Array.isArray(value.coveredLayerIds)
  ) {
    throw new Error('PRODUCT_FACTORY_RELEASE_INVALID_RECORD');
  }

  const coveredLayerIds = uniqueSorted(value.coveredLayerIds.filter((entry): entry is string => typeof entry === 'string'));

  return {
    productFactoryReleaseAcceptanceRecordId,
    releaseTrack,
    coveredLayerIds,
    lifecycleAcceptanceId,
    replayValidationId,
    docsCompletenessId,
    releaseHardeningId,
    status: status as ProductFactoryReleaseAcceptanceRecord['status'],
    outcome: outcome as ProductFactoryReleaseAcceptanceRecord['outcome'],
  };
}

function readStore(filePath: string): ProductFactoryReleaseStore {
  if (!fs.existsSync(filePath)) {
    return { records: [] };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('PRODUCT_FACTORY_RELEASE_INVALID_STORE');
  }

  const records = Array.isArray(parsed.records)
    ? parsed.records.map((entry) => parseReleaseRecord(entry)).sort((left, right) => left.productFactoryReleaseAcceptanceRecordId.localeCompare(right.productFactoryReleaseAcceptanceRecordId))
    : [];

  return { records };
}

function writeStore(filePath: string, store: ProductFactoryReleaseStore): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${canonicalStringify({
    records: [...store.records].sort((left, right) => left.productFactoryReleaseAcceptanceRecordId.localeCompare(right.productFactoryReleaseAcceptanceRecordId)),
  })}\n`, 'utf8');
}

function deriveLayerStateFromStatus(input: {
  layerClass: ProductFactoryReleaseLayerSummary['layerClass'];
  status: string;
}): ProductFactoryReleaseLayerSummary['state'] {
  const status = input.status;

  if (input.layerClass === 'build_run') {
    if (status === 'completed') {
      return 'accepted';
    }
    if (status === 'failed') {
      return 'failed';
    }
    if (status === 'running' || status === 'ready') {
      return 'partial';
    }
    return 'inconclusive';
  }

  if (input.layerClass === 'build_evidence') {
    if (status === 'verified') {
      return 'accepted';
    }
    if (status === 'failed') {
      return 'failed';
    }
    if (status === 'blocked') {
      return 'blocked';
    }
    if (status === 'created') {
      return 'partial';
    }
    return 'inconclusive';
  }

  if (input.layerClass === 'commerce_intent') {
    if (status === 'fulfilled') {
      return 'accepted';
    }
    if (status === 'failed') {
      return 'failed';
    }
    if (status === 'blocked') {
      return 'blocked';
    }
    if (status === 'pending' || status === 'draft') {
      return 'partial';
    }
    return 'inconclusive';
  }

  if (status === 'ready' || status === 'validated' || status === 'materialized' || status === 'complete') {
    return 'accepted';
  }
  if (status === 'blocked') {
    return 'blocked';
  }
  if (status === 'failed') {
    return 'failed';
  }
  if (status === 'draft' || status === 'incomplete') {
    return 'partial';
  }

  return 'inconclusive';
}

function toCoveredLayerIds(input: ProductFactoryReleaseUpstreamContext['ids']): string[] {
  return uniqueSorted([
    `build-evidence:${input.buildEvidenceBundleId}`,
    `build-run:${input.runId}`,
    `codex-packet:${input.packetId}`,
    `commerce-intent:${input.chargeIntentId}`,
    `engineering-plan:${input.planId}`,
    `product-spec:${input.productSpecId}`,
    `repo-scaffold:${input.bundleId}`,
    `task-graph:${input.taskGraphId}`,
  ]);
}

function toLayerSummaries(input: ProductFactoryReleaseUpstreamContext): ProductFactoryReleaseLayerSummary[] {
  const summaries: ProductFactoryReleaseLayerSummary[] = [
    {
      layerId: `product-spec:${input.ids.productSpecId}`,
      layerClass: 'product_spec',
      status: input.summaries.productSpec.status,
      state: deriveLayerStateFromStatus({ layerClass: 'product_spec', status: input.summaries.productSpec.status }),
      reasonTokens: uniqueSorted([
        `product_spec_status:${input.summaries.productSpec.status}`,
        `product_spec_validation:${input.summaries.productSpec.validationState}`,
      ]),
    },
    {
      layerId: `engineering-plan:${input.ids.planId}`,
      layerClass: 'engineering_plan',
      status: input.summaries.engineeringPlan.status,
      state: deriveLayerStateFromStatus({ layerClass: 'engineering_plan', status: input.summaries.engineeringPlan.status }),
      reasonTokens: uniqueSorted([
        `engineering_plan_status:${input.summaries.engineeringPlan.status}`,
        `engineering_plan_validation:${input.summaries.engineeringPlan.validationState}`,
      ]),
    },
    {
      layerId: `task-graph:${input.ids.taskGraphId}`,
      layerClass: 'task_graph',
      status: input.summaries.taskGraph.status,
      state: deriveLayerStateFromStatus({ layerClass: 'task_graph', status: input.summaries.taskGraph.status }),
      reasonTokens: uniqueSorted([
        `task_graph_status:${input.summaries.taskGraph.status}`,
        `task_graph_plan_validation:${input.summaries.taskGraph.planValidationState}`,
      ]),
    },
    {
      layerId: `codex-packet:${input.ids.packetId}`,
      layerClass: 'codex_packet',
      status: input.summaries.codexPacket.status,
      state: deriveLayerStateFromStatus({ layerClass: 'codex_packet', status: input.summaries.codexPacket.status }),
      reasonTokens: uniqueSorted([
        `codex_packet_status:${input.summaries.codexPacket.status}`,
        `codex_packet_validation:${input.summaries.codexPacket.validationState}`,
      ]),
    },
    {
      layerId: `repo-scaffold:${input.ids.bundleId}`,
      layerClass: 'repo_scaffold',
      status: input.summaries.repoScaffold.status,
      state: deriveLayerStateFromStatus({ layerClass: 'repo_scaffold', status: input.summaries.repoScaffold.status }),
      reasonTokens: uniqueSorted([
        `repo_scaffold_status:${input.summaries.repoScaffold.status}`,
        `repo_scaffold_validation:${input.summaries.repoScaffold.validationState}`,
      ]),
    },
    {
      layerId: `build-run:${input.ids.runId}`,
      layerClass: 'build_run',
      status: input.summaries.buildRun.status,
      state: deriveLayerStateFromStatus({ layerClass: 'build_run', status: input.summaries.buildRun.status }),
      reasonTokens: uniqueSorted([
        `build_run_status:${input.summaries.buildRun.status}`,
        `build_run_validation:${input.summaries.buildRun.validationState}`,
      ]),
    },
    {
      layerId: `build-evidence:${input.ids.buildEvidenceBundleId}`,
      layerClass: 'build_evidence',
      status: input.summaries.buildEvidence.verificationStatus,
      state: deriveLayerStateFromStatus({ layerClass: 'build_evidence', status: input.summaries.buildEvidence.verificationStatus }),
      reasonTokens: uniqueSorted([
        `build_evidence_status:${input.summaries.buildEvidence.verificationStatus}`,
        `build_evidence_governance:${input.summaries.buildEvidence.governanceValidation}`,
        `build_evidence_outcome:${input.summaries.buildEvidence.outcome}`,
      ]),
    },
    {
      layerId: `commerce-intent:${input.ids.chargeIntentId}`,
      layerClass: 'commerce_intent',
      status: input.summaries.commerceIntent.status,
      state: deriveLayerStateFromStatus({ layerClass: 'commerce_intent', status: input.summaries.commerceIntent.status }),
      reasonTokens: uniqueSorted([
        `commerce_status:${input.summaries.commerceIntent.status}`,
        `commerce_outcome:${input.summaries.commerceIntent.outcome}`,
      ]),
    },
  ];

  return summaries.sort((left, right) => left.layerId.localeCompare(right.layerId));
}

function findChargeIntentIdInHistory(history: ProductFactoryReleaseHistoryEvent[]): string | null {
  for (const event of [...history].sort((left, right) => left.eventType.localeCompare(right.eventType))) {
    const candidate = isRecord(event.payload) ? asString(event.payload.chargeIntentId) : null;
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function findChargeIntentIdInCoveredLayers(coveredLayerIds: string[]): string | null {
  const value = coveredLayerIds.find((entry) => entry.startsWith('commerce-intent:'));
  if (!value) {
    return null;
  }

  const chargeIntentId = value.slice('commerce-intent:'.length).trim();
  return chargeIntentId.length > 0 ? chargeIntentId : null;
}

function findPresentDocumentIdsInHistory(history: ProductFactoryReleaseHistoryEvent[]): string[] {
  const sorted = [...history].sort((left, right) => left.eventType.localeCompare(right.eventType));
  const lastDocsEvent = [...sorted].reverse().find((entry) => entry.eventType === 'product_factory_docs_completeness_recorded');
  if (lastDocsEvent && isRecord(lastDocsEvent.payload) && Array.isArray(lastDocsEvent.payload.presentDocumentIds)) {
    return uniqueSorted(lastDocsEvent.payload.presentDocumentIds.filter((entry): entry is string => typeof entry === 'string'));
  }

  const createdEvent = sorted.find((entry) => entry.eventType === 'product_factory_release_acceptance_record_created');
  if (createdEvent && isRecord(createdEvent.payload) && Array.isArray(createdEvent.payload.presentDocumentIds)) {
    return uniqueSorted(createdEvent.payload.presentDocumentIds.filter((entry): entry is string => typeof entry === 'string'));
  }

  return [];
}

export function createProductFactoryReleaseManager(options: {
  recordsFilePath?: string;
  historyStore?: ProductFactoryReleaseHistoryStore;
  historyFilePath?: string;
  commerceManager?: CommerceManager;
  buildEvidenceManager?: BuildEvidenceManager;
  buildExecutionManager?: BuildExecutionManager;
  packetManager?: CodexExecutionPacketManager;
  scaffoldManager?: RepoScaffoldManager;
  taskGraphManager?: ImplementationTaskGraphManager;
  engineeringPlanManager?: EngineeringPlanManager;
  productSpecManager?: ProductSpecManager;
  commerceFilePath?: string;
  commerceHistoryFilePath?: string;
  evidenceBundlesFilePath?: string;
  evidenceHistoryFilePath?: string;
  runsFilePath?: string;
  runHistoryFilePath?: string;
  packetsFilePath?: string;
  packetHistoryFilePath?: string;
  bundlesFilePath?: string;
  bundleHistoryFilePath?: string;
  taskGraphsFilePath?: string;
  taskGraphHistoryFilePath?: string;
  plansFilePath?: string;
  engineeringPlanHistoryFilePath?: string;
  specsFilePath?: string;
  specHistoryFilePath?: string;
} = {}) {
  const recordsFilePath = options.recordsFilePath ?? DEFAULT_PRODUCT_FACTORY_RELEASE_RECORDS_FILE;

  const historyStore = options.historyStore ?? createProductFactoryReleaseHistoryStore({
    historyFilePath: options.historyFilePath,
  });

  const productSpecManager = options.productSpecManager ?? createProductSpecManager({
    specsFilePath: options.specsFilePath,
    historyFilePath: options.specHistoryFilePath,
  });

  const engineeringPlanManager = options.engineeringPlanManager ?? createEngineeringPlanManager({
    plansFilePath: options.plansFilePath,
    historyFilePath: options.engineeringPlanHistoryFilePath,
  });

  const taskGraphManager = options.taskGraphManager ?? createImplementationTaskGraphManager({
    taskGraphsFilePath: options.taskGraphsFilePath,
    historyFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  const packetManager = options.packetManager ?? createCodexExecutionPacketManager({
    packetsFilePath: options.packetsFilePath,
    historyFilePath: options.packetHistoryFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  const scaffoldManager = options.scaffoldManager ?? createRepoScaffoldManager({
    bundlesFilePath: options.bundlesFilePath,
    historyFilePath: options.bundleHistoryFilePath,
    packetsFilePath: options.packetsFilePath,
    packetHistoryFilePath: options.packetHistoryFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  const buildExecutionManager = options.buildExecutionManager ?? createBuildExecutionManager({
    runsFilePath: options.runsFilePath,
    historyFilePath: options.runHistoryFilePath,
    packetsFilePath: options.packetsFilePath,
    packetHistoryFilePath: options.packetHistoryFilePath,
    bundlesFilePath: options.bundlesFilePath,
    bundleHistoryFilePath: options.bundleHistoryFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  const buildEvidenceManager = options.buildEvidenceManager ?? createBuildEvidenceManager({
    bundlesFilePath: options.evidenceBundlesFilePath,
    historyFilePath: options.evidenceHistoryFilePath,
    runsFilePath: options.runsFilePath,
    runHistoryFilePath: options.runHistoryFilePath,
    packetsFilePath: options.packetsFilePath,
    packetHistoryFilePath: options.packetHistoryFilePath,
    bundlesRuntimeFilePath: options.bundlesFilePath,
    bundleHistoryFilePath: options.bundleHistoryFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  const commerceManager = options.commerceManager ?? createCommerceManager({
    commerceFilePath: options.commerceFilePath,
    historyFilePath: options.commerceHistoryFilePath,
    evidenceBundlesFilePath: options.evidenceBundlesFilePath,
    evidenceHistoryFilePath: options.evidenceHistoryFilePath,
    runsFilePath: options.runsFilePath,
    runHistoryFilePath: options.runHistoryFilePath,
    packetsFilePath: options.packetsFilePath,
    packetHistoryFilePath: options.packetHistoryFilePath,
    bundlesFilePath: options.bundlesFilePath,
    bundleHistoryFilePath: options.bundleHistoryFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
    specsFilePath: options.specsFilePath,
    specHistoryFilePath: options.specHistoryFilePath,
  });

  function getReleaseAcceptanceRecord(productFactoryReleaseAcceptanceRecordId: string): ProductFactoryReleaseAcceptanceRecord {
    const record = readStore(recordsFilePath).records
      .find((entry) => entry.productFactoryReleaseAcceptanceRecordId === productFactoryReleaseAcceptanceRecordId);
    if (!record) {
      throw new Error(`PRODUCT_FACTORY_RELEASE_NOT_FOUND: ${productFactoryReleaseAcceptanceRecordId}`);
    }

    return record;
  }

  function listReleaseAcceptanceRecords(): ProductFactoryReleaseAcceptanceRecord[] {
    return readStore(recordsFilePath).records;
  }

  function appendReleaseEvent(input: {
    productFactoryReleaseAcceptanceRecordId: string;
    releaseTrack: string;
    eventType: Parameters<ProductFactoryReleaseHistoryStore['appendProductFactoryReleaseEvent']>[0]['eventType'];
    payload: Record<string, unknown>;
  }) {
    return historyStore.appendProductFactoryReleaseEvent({
      productFactoryReleaseAcceptanceRecordId: input.productFactoryReleaseAcceptanceRecordId,
      releaseTrack: input.releaseTrack,
      eventType: input.eventType,
      payloadHash: toProductFactoryReleasePayloadHash(input.payload),
      payload: JSON.parse(canonicalStringify(input.payload)) as Record<string, unknown>,
    });
  }

  function resolveUpstreamContextFromChargeIntent(chargeIntentId: string): ProductFactoryReleaseUpstreamContext {
    const chargeIntent = commerceManager.getChargeIntent(chargeIntentId);
    const evidenceBundle = buildEvidenceManager.getBuildEvidenceBundle(chargeIntent.buildEvidenceBundleId);
    const run = buildExecutionManager.getBuildExecutionRun(chargeIntent.runId);
    const packet = packetManager.getCodexExecutionPacket(chargeIntent.packetId);
    const scaffoldBundle = scaffoldManager.getRepoScaffoldBundle(chargeIntent.bundleId);
    const taskGraph = taskGraphManager.getImplementationTaskGraph(chargeIntent.graphId);
    const plan = engineeringPlanManager.getEngineeringPlan(chargeIntent.planId);
    const spec = productSpecManager.getProductSpec(chargeIntent.productSpecId);

    const specProjection = productSpecManager.deriveProductSpecProjection(spec.specId);
    const engineeringProjection = engineeringPlanManager.deriveEngineeringPlanProjection(plan.planId);
    const taskGraphProjection = taskGraphManager.deriveImplementationTaskGraphProjection(taskGraph.taskGraphId);
    const packetProjection = packetManager.deriveCodexExecutionPacketProjection(packet.packetId);
    const scaffoldProjection = scaffoldManager.deriveRepoScaffoldProjection(scaffoldBundle.bundleId);
    const runProjection = buildExecutionManager.deriveBuildExecutionProjection(run.runId);
    const evidenceProjection = buildEvidenceManager.deriveBuildEvidenceProjection(evidenceBundle.buildEvidenceBundleId);
    const commerceProjection = commerceManager.deriveCommerceProjection(chargeIntent.chargeIntentId);

    const replayChecks: ReplayCheck[] = [
      {
        subsystemId: `product-spec:${spec.specId}`,
        state: chargeIntent.productSpecId === spec.specId ? 'pass' : 'failed',
        reasonToken: chargeIntent.productSpecId === spec.specId ? 'product_spec_reference_consistent' : 'product_spec_reference_mismatch',
      },
      {
        subsystemId: `engineering-plan:${plan.planId}`,
        state: plan.specId === spec.specId ? 'pass' : 'failed',
        reasonToken: plan.specId === spec.specId ? 'engineering_plan_reference_consistent' : 'engineering_plan_reference_mismatch',
      },
      {
        subsystemId: `task-graph:${taskGraph.taskGraphId}`,
        state: taskGraph.planId === plan.planId ? 'pass' : 'failed',
        reasonToken: taskGraph.planId === plan.planId ? 'task_graph_reference_consistent' : 'task_graph_reference_mismatch',
      },
      {
        subsystemId: `codex-packet:${packet.packetId}`,
        state: packet.graphId === taskGraph.taskGraphId ? 'pass' : 'failed',
        reasonToken: packet.graphId === taskGraph.taskGraphId ? 'codex_packet_reference_consistent' : 'codex_packet_reference_mismatch',
      },
      {
        subsystemId: `repo-scaffold:${scaffoldBundle.bundleId}`,
        state: scaffoldBundle.packetId === packet.packetId ? 'pass' : 'failed',
        reasonToken: scaffoldBundle.packetId === packet.packetId ? 'repo_scaffold_reference_consistent' : 'repo_scaffold_reference_mismatch',
      },
      {
        subsystemId: `build-run:${run.runId}`,
        state: run.packetId === packet.packetId && run.bundleId === scaffoldBundle.bundleId ? 'pass' : 'failed',
        reasonToken: run.packetId === packet.packetId && run.bundleId === scaffoldBundle.bundleId
          ? 'build_run_reference_consistent'
          : 'build_run_reference_mismatch',
      },
      {
        subsystemId: `build-evidence:${evidenceBundle.buildEvidenceBundleId}`,
        state: evidenceBundle.runId === run.runId && evidenceBundle.packetId === packet.packetId ? 'pass' : 'failed',
        reasonToken: evidenceBundle.runId === run.runId && evidenceBundle.packetId === packet.packetId
          ? 'build_evidence_reference_consistent'
          : 'build_evidence_reference_mismatch',
      },
      {
        subsystemId: `commerce-intent:${chargeIntent.chargeIntentId}`,
        state: chargeIntent.buildEvidenceBundleId === evidenceBundle.buildEvidenceBundleId ? 'pass' : 'failed',
        reasonToken: chargeIntent.buildEvidenceBundleId === evidenceBundle.buildEvidenceBundleId
          ? 'commerce_reference_consistent'
          : 'commerce_reference_mismatch',
      },
    ];

    return {
      ids: {
        productSpecId: spec.specId,
        planId: plan.planId,
        taskGraphId: taskGraph.taskGraphId,
        packetId: packet.packetId,
        bundleId: scaffoldBundle.bundleId,
        runId: run.runId,
        buildEvidenceBundleId: evidenceBundle.buildEvidenceBundleId,
        chargeIntentId: chargeIntent.chargeIntentId,
      },
      summaries: {
        productSpec: {
          status: specProjection.status,
          validationState: specProjection.validationState,
        },
        engineeringPlan: {
          status: engineeringProjection.status,
          validationState: engineeringProjection.validationState,
        },
        taskGraph: {
          status: taskGraphProjection.status,
          planValidationState: taskGraphProjection.planValidationState,
        },
        codexPacket: {
          status: packetProjection.status,
          validationState: packetProjection.validationState,
        },
        repoScaffold: {
          status: scaffoldProjection.status,
          validationState: scaffoldProjection.validationState,
        },
        buildRun: {
          status: runProjection.status,
          validationState: runProjection.validationState,
        },
        buildEvidence: {
          verificationStatus: evidenceProjection.verificationStatus,
          governanceValidation: evidenceProjection.governanceValidation,
          outcome: evidenceProjection.outcome,
        },
        commerceIntent: {
          status: commerceProjection.status,
          outcome: commerceProjection.outcome,
        },
      },
      replayChecks,
    };
  }

  function deriveReleaseProjection(
    productFactoryReleaseAcceptanceRecordId: string,
    options: {
      presentDocumentIds?: string[];
    } = {},
  ): ProductFactoryReleaseProjection {
    const record = getReleaseAcceptanceRecord(productFactoryReleaseAcceptanceRecordId);
    const releaseHistory = historyStore.listProductFactoryReleaseEvents(record.productFactoryReleaseAcceptanceRecordId);

    const chargeIntentId = findChargeIntentIdInHistory(releaseHistory)
      ?? findChargeIntentIdInCoveredLayers(record.coveredLayerIds);

    if (!chargeIntentId) {
      throw new Error(`PRODUCT_FACTORY_RELEASE_CHARGE_INTENT_NOT_FOUND: ${productFactoryReleaseAcceptanceRecordId}`);
    }

    const upstreamContext = resolveUpstreamContextFromChargeIntent(chargeIntentId);

    const presentDocumentIds = options.presentDocumentIds
      ? uniqueSorted(options.presentDocumentIds)
      : findPresentDocumentIdsInHistory(releaseHistory);

    return projectProductFactoryRelease({
      acceptanceRecord: record,
      coveredLayerSummaries: toLayerSummaries(upstreamContext),
      replayChecks: upstreamContext.replayChecks,
      requiredDocumentIds: [...PRODUCT_FACTORY_RELEASE_REQUIRED_DOCUMENT_IDS],
      presentDocumentIds,
      releaseHistory,
    });
  }

  function createReleaseAcceptanceRecord(input: {
    releaseTrack: string;
    chargeIntentId: string;
    presentDocumentIds?: string[];
  }): ProductFactoryReleaseCreateSummary {
    const upstreamContext = resolveUpstreamContextFromChargeIntent(input.chargeIntentId);
    const coveredLayerIds = toCoveredLayerIds(upstreamContext.ids);
    const releaseTrack = input.releaseTrack.trim();

    if (releaseTrack.length === 0) {
      throw new Error('PRODUCT_FACTORY_RELEASE_TRACK_REQUIRED');
    }

    const provisionalRecordId = deriveProductFactoryReleaseAcceptanceRecordId({
      releaseTrack,
      coveredLayerIds,
    });

    const provisionalRecord: ProductFactoryReleaseAcceptanceRecord = {
      productFactoryReleaseAcceptanceRecordId: provisionalRecordId,
      releaseTrack,
      coveredLayerIds,
      lifecycleAcceptanceId: 'pending',
      replayValidationId: 'pending',
      docsCompletenessId: 'pending',
      releaseHardeningId: 'pending',
      status: 'draft',
      outcome: 'not_ready',
    };

    const initialProjection = projectProductFactoryRelease({
      acceptanceRecord: provisionalRecord,
      coveredLayerSummaries: toLayerSummaries(upstreamContext),
      replayChecks: upstreamContext.replayChecks,
      requiredDocumentIds: [...PRODUCT_FACTORY_RELEASE_REQUIRED_DOCUMENT_IDS],
      presentDocumentIds: uniqueSorted(input.presentDocumentIds ?? []),
      releaseHistory: [],
    });

    const record = createProductFactoryReleaseAcceptanceRecord({
      releaseTrack,
      coveredLayerIds,
      lifecycleAcceptanceId: initialProjection.lifecycleAcceptanceSummary.productFactoryLifecycleAcceptanceId,
      replayValidationId: initialProjection.replayValidationSummary.productFactoryReplayValidationId,
      docsCompletenessId: initialProjection.docsCompletenessSummary.productFactoryDocsCompletenessId,
      releaseHardeningId: initialProjection.releaseHardeningSummary.productFactoryReleaseHardeningId,
      status: initialProjection.status,
      outcome: initialProjection.outcome,
    });

    const store = readStore(recordsFilePath);
    if (!store.records.some((entry) => entry.productFactoryReleaseAcceptanceRecordId === record.productFactoryReleaseAcceptanceRecordId)) {
      writeStore(recordsFilePath, {
        records: [...store.records, record],
      });

      appendReleaseEvent({
        productFactoryReleaseAcceptanceRecordId: record.productFactoryReleaseAcceptanceRecordId,
        releaseTrack: record.releaseTrack,
        eventType: 'product_factory_release_acceptance_record_created',
        payload: {
          productFactoryReleaseAcceptanceRecordId: record.productFactoryReleaseAcceptanceRecordId,
          releaseTrack: record.releaseTrack,
          chargeIntentId: input.chargeIntentId,
          coveredLayerIds: record.coveredLayerIds,
          presentDocumentIds: uniqueSorted(input.presentDocumentIds ?? []),
        },
      });
    }

    return {
      productFactoryReleaseAcceptanceRecordId: record.productFactoryReleaseAcceptanceRecordId,
      releaseTrack: record.releaseTrack,
    };
  }

  function validateReleaseAcceptance(
    productFactoryReleaseAcceptanceRecordId: string,
    presentDocumentIds: string[] = [],
  ): ProductFactoryReleaseProjection {
    const projection = deriveReleaseProjection(productFactoryReleaseAcceptanceRecordId, { presentDocumentIds });

    for (const event of deriveProductFactoryReleaseProjectionEvents({ projection })) {
      appendReleaseEvent({
        productFactoryReleaseAcceptanceRecordId: event.productFactoryReleaseAcceptanceRecordId,
        releaseTrack: event.releaseTrack,
        eventType: event.eventType,
        payload: event.payload,
      });
    }

    if (projection.status === 'failed' || projection.outcome === 'failed') {
      appendReleaseEvent({
        productFactoryReleaseAcceptanceRecordId: projection.productFactoryReleaseAcceptanceRecordId,
        releaseTrack: projection.releaseTrack,
        eventType: 'product_factory_release_failed',
        payload: {
          productFactoryReleaseAcceptanceRecordId: projection.productFactoryReleaseAcceptanceRecordId,
          releaseTrack: projection.releaseTrack,
          status: projection.status,
          outcome: projection.outcome,
        },
      });
    }

    return deriveReleaseProjection(productFactoryReleaseAcceptanceRecordId);
  }

  function closeReleaseAcceptance(productFactoryReleaseAcceptanceRecordId: string): ProductFactoryReleaseProjection {
    const projection = deriveReleaseProjection(productFactoryReleaseAcceptanceRecordId);

    appendReleaseEvent({
      productFactoryReleaseAcceptanceRecordId: projection.productFactoryReleaseAcceptanceRecordId,
      releaseTrack: projection.releaseTrack,
      eventType: 'product_factory_release_closed',
      payload: {
        productFactoryReleaseAcceptanceRecordId: projection.productFactoryReleaseAcceptanceRecordId,
        releaseTrack: projection.releaseTrack,
        status: projection.status,
        outcome: projection.outcome,
      },
    });

    return deriveReleaseProjection(productFactoryReleaseAcceptanceRecordId);
  }

  function listReleaseProjections(): ProductFactoryReleaseProjection[] {
    return listReleaseAcceptanceRecords()
      .map((entry) => deriveReleaseProjection(entry.productFactoryReleaseAcceptanceRecordId))
      .sort((left, right) => left.productFactoryReleaseAcceptanceRecordId.localeCompare(right.productFactoryReleaseAcceptanceRecordId));
  }

  return {
    historyStore,
    commerceManager,
    buildEvidenceManager,
    buildExecutionManager,
    packetManager,
    scaffoldManager,
    taskGraphManager,
    engineeringPlanManager,
    productSpecManager,
    appendReleaseEvent,
    getReleaseAcceptanceRecord,
    listReleaseAcceptanceRecords,
    createReleaseAcceptanceRecord,
    deriveReleaseProjection,
    validateReleaseAcceptance,
    closeReleaseAcceptance,
    listReleaseProjections,
  };
}

export type ProductFactoryReleaseManager = ReturnType<typeof createProductFactoryReleaseManager>;
