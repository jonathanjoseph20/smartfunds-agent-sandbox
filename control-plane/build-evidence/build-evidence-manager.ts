import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import {
  createBuildExecutionManager,
  type BuildExecutionManager,
} from '../build-runtime/build-execution-manager.ts';
import {
  createCodexExecutionPacketManager,
  type CodexExecutionPacketManager,
} from '../codex/codex-execution-packet-manager.ts';
import {
  createRepoScaffoldManager,
  type RepoScaffoldManager,
} from '../repo-scaffold/repo-scaffold-manager.ts';

import { buildEvidenceBundleFromExecution } from './build-evidence-bundle.ts';
import {
  createBuildEvidenceHistoryStore,
  type BuildEvidenceHistoryStore,
} from './build-evidence-history-store.ts';
import { projectBuildEvidenceBundle, deriveBuildEvidenceProjectionEvents } from './build-evidence-projection.ts';
import type {
  BuildEvidenceBundle,
  BuildEvidenceCreateSummary,
  BuildEvidenceProjection,
} from './build-evidence-types.ts';

const DEFAULT_BUILD_EVIDENCE_BUNDLES_FILE = path.join(
  'runtime-data',
  'build-evidence',
  'build-evidence-bundles.json',
);

type BuildEvidenceStore = {
  bundles: BuildEvidenceBundle[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseBundle(value: unknown): BuildEvidenceBundle {
  if (!isRecord(value)) {
    throw new Error('BUILD_EVIDENCE_INVALID_BUNDLE');
  }

  const buildEvidenceBundleId = asString(value.buildEvidenceBundleId);
  const runId = asString(value.runId);
  const packetId = asString(value.packetId);
  const bundleId = asString(value.bundleId);
  const promptHash = asString(value.promptHash);
  const executionPlanHash = asString(value.executionPlanHash);
  const verificationStatus = asString(value.verificationStatus);
  const outcome = asString(value.outcome);

  if (!buildEvidenceBundleId || !runId || !packetId || !bundleId || !promptHash || !executionPlanHash || !verificationStatus || !outcome) {
    throw new Error('BUILD_EVIDENCE_INVALID_BUNDLE');
  }

  const artifactHashes = Array.isArray(value.artifactHashes)
    ? value.artifactHashes
      .map((entry) => {
        if (!isRecord(entry)) {
          throw new Error('BUILD_EVIDENCE_INVALID_BUNDLE');
        }

        const artifactId = asString(entry.artifactId);
        const artifactClass = asString(entry.artifactClass);
        const filePath = asString(entry.filePath);
        const contentHash = asString(entry.contentHash);

        if (!artifactId || !artifactClass || !filePath || !contentHash) {
          throw new Error('BUILD_EVIDENCE_INVALID_BUNDLE');
        }

        return {
          artifactId,
          artifactClass: artifactClass as BuildEvidenceBundle['artifactHashes'][number]['artifactClass'],
          filePath,
          contentHash,
        };
      })
      .sort((left, right) => left.artifactId.localeCompare(right.artifactId))
    : [];

  return {
    buildEvidenceBundleId,
    runId,
    packetId,
    bundleId,
    promptHash,
    executionPlanHash,
    artifactHashes,
    verificationStatus: verificationStatus as BuildEvidenceBundle['verificationStatus'],
    outcome: outcome as BuildEvidenceBundle['outcome'],
  };
}

function readStore(filePath: string): BuildEvidenceStore {
  if (!fs.existsSync(filePath)) {
    return { bundles: [] };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('BUILD_EVIDENCE_INVALID_STORE');
  }

  const bundles = Array.isArray(parsed.bundles)
    ? parsed.bundles.map((entry) => parseBundle(entry)).sort((left, right) => left.buildEvidenceBundleId.localeCompare(right.buildEvidenceBundleId))
    : [];

  return { bundles };
}

function writeStore(filePath: string, store: BuildEvidenceStore): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${canonicalStringify({
    bundles: [...store.bundles].sort((left, right) => left.buildEvidenceBundleId.localeCompare(right.buildEvidenceBundleId)),
  })}\n`, 'utf8');
}

function toPayloadHash(payload: unknown): string {
  return sha256(canonicalStringify(payload));
}

export function createBuildEvidenceManager(options: {
  bundlesFilePath?: string;
  historyStore?: BuildEvidenceHistoryStore;
  historyFilePath?: string;
  buildExecutionManager?: BuildExecutionManager;
  packetManager?: CodexExecutionPacketManager;
  scaffoldManager?: RepoScaffoldManager;
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
} = {}) {
  const bundlesFilePath = options.bundlesFilePath ?? DEFAULT_BUILD_EVIDENCE_BUNDLES_FILE;

  const historyStore = options.historyStore ?? createBuildEvidenceHistoryStore({
    historyFilePath: options.historyFilePath,
  });

  const buildExecutionManager = options.buildExecutionManager ?? createBuildExecutionManager({
    runsFilePath: options.runsFilePath,
    historyFilePath: options.runHistoryFilePath,
    packetsFilePath: options.packetsFilePath,
    packetHistoryFilePath: options.packetHistoryFilePath,
    bundlesFilePath: options.bundlesRuntimeFilePath,
    bundleHistoryFilePath: options.bundleHistoryFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
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
    bundlesFilePath: options.bundlesRuntimeFilePath,
    historyFilePath: options.bundleHistoryFilePath,
    packetsFilePath: options.packetsFilePath,
    packetHistoryFilePath: options.packetHistoryFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  function getBuildEvidenceBundle(buildEvidenceBundleId: string): BuildEvidenceBundle {
    const bundle = readStore(bundlesFilePath).bundles.find((entry) => entry.buildEvidenceBundleId === buildEvidenceBundleId);
    if (!bundle) {
      throw new Error(`BUILD_EVIDENCE_BUNDLE_NOT_FOUND: ${buildEvidenceBundleId}`);
    }

    return bundle;
  }

  function listBuildEvidenceBundles(): BuildEvidenceBundle[] {
    return readStore(bundlesFilePath).bundles;
  }

  function appendBuildEvidenceEvent(input: {
    buildEvidenceBundleId: string;
    runId: string;
    eventType: Parameters<BuildEvidenceHistoryStore['appendBuildEvidenceEvent']>[0]['eventType'];
    payload: Record<string, unknown>;
  }) {
    return historyStore.appendBuildEvidenceEvent({
      buildEvidenceBundleId: input.buildEvidenceBundleId,
      runId: input.runId,
      eventType: input.eventType,
      payloadHash: toPayloadHash(input.payload),
      payload: JSON.parse(canonicalStringify(input.payload)) as Record<string, unknown>,
    });
  }

  function createBuildEvidenceBundle(runId: string): BuildEvidenceCreateSummary {
    const run = buildExecutionManager.getBuildExecutionRun(runId);
    const packet = packetManager.getCodexExecutionPacket(run.packetId);
    const scaffoldBundle = scaffoldManager.getRepoScaffoldBundle(run.bundleId);

    const bundle = buildEvidenceBundleFromExecution({
      run,
      packet,
      bundle: scaffoldBundle,
    });

    const store = readStore(bundlesFilePath);
    const existing = store.bundles.find((entry) => entry.buildEvidenceBundleId === bundle.buildEvidenceBundleId);
    if (!existing) {
      writeStore(bundlesFilePath, {
        bundles: [...store.bundles, bundle],
      });

      appendBuildEvidenceEvent({
        buildEvidenceBundleId: bundle.buildEvidenceBundleId,
        runId: bundle.runId,
        eventType: 'build_evidence_bundle_created',
        payload: {
          buildEvidenceBundleId: bundle.buildEvidenceBundleId,
          runId: bundle.runId,
          packetId: bundle.packetId,
          bundleId: bundle.bundleId,
        },
      });
    }

    return {
      buildEvidenceBundleId: bundle.buildEvidenceBundleId,
      runId: bundle.runId,
      packetId: bundle.packetId,
      bundleId: bundle.bundleId,
    };
  }

  function deriveBuildEvidenceProjection(buildEvidenceBundleId: string): BuildEvidenceProjection {
    const bundle = getBuildEvidenceBundle(buildEvidenceBundleId);
    const run = buildExecutionManager.getBuildExecutionRun(bundle.runId);
    const packet = packetManager.getCodexExecutionPacket(bundle.packetId);
    const history = historyStore.listBuildEvidenceEvents(buildEvidenceBundleId);

    return projectBuildEvidenceBundle({
      bundle,
      run,
      packet,
      history,
    });
  }

  function verifyBuildEvidenceBundle(buildEvidenceBundleId: string): BuildEvidenceProjection {
    const projection = deriveBuildEvidenceProjection(buildEvidenceBundleId);

    const store = readStore(bundlesFilePath);
    const index = store.bundles.findIndex((entry) => entry.buildEvidenceBundleId === buildEvidenceBundleId);
    if (index < 0) {
      throw new Error(`BUILD_EVIDENCE_BUNDLE_NOT_FOUND: ${buildEvidenceBundleId}`);
    }

    const updated: BuildEvidenceBundle = {
      ...store.bundles[index]!,
      verificationStatus: projection.verificationStatus,
      outcome: projection.outcome,
    };

    const bundles = [...store.bundles];
    bundles[index] = updated;
    writeStore(bundlesFilePath, { bundles });

    for (const event of deriveBuildEvidenceProjectionEvents({ projection })) {
      appendBuildEvidenceEvent({
        buildEvidenceBundleId: event.buildEvidenceBundleId,
        runId: event.runId,
        eventType: event.eventType,
        payload: event.payload,
      });
    }

    if (projection.verificationStatus === 'failed') {
      appendBuildEvidenceEvent({
        buildEvidenceBundleId: projection.buildEvidenceBundleId,
        runId: projection.runId,
        eventType: 'build_evidence_failed',
        payload: {
          buildEvidenceBundleId: projection.buildEvidenceBundleId,
          runId: projection.runId,
          governanceValidation: projection.governanceValidation,
          outcome: projection.outcome,
        },
      });
    }

    return deriveBuildEvidenceProjection(buildEvidenceBundleId);
  }

  function listBuildEvidenceProjections(): BuildEvidenceProjection[] {
    return listBuildEvidenceBundles()
      .map((bundle) => deriveBuildEvidenceProjection(bundle.buildEvidenceBundleId))
      .sort((left, right) => left.buildEvidenceBundleId.localeCompare(right.buildEvidenceBundleId));
  }

  return {
    historyStore,
    buildExecutionManager,
    packetManager,
    scaffoldManager,
    getBuildEvidenceBundle,
    listBuildEvidenceBundles,
    appendBuildEvidenceEvent,
    createBuildEvidenceBundle,
    deriveBuildEvidenceProjection,
    verifyBuildEvidenceBundle,
    listBuildEvidenceProjections,
  };
}

export type BuildEvidenceManager = ReturnType<typeof createBuildEvidenceManager>;
