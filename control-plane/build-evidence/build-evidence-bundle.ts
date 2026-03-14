import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import type { BuildExecutionRun } from '../build-runtime/build-execution-types.ts';
import type { CodexExecutionPacket } from '../codex/codex-execution-packet-types.ts';
import type { RepositoryScaffoldBundle } from '../repo-scaffold/repo-scaffold-types.ts';

import { deriveBuildEvidenceBundleId } from './build-evidence-identity.ts';
import type { BuildEvidenceBundle } from './build-evidence-types.ts';

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

export function deriveArtifactHashes(run: BuildExecutionRun): BuildEvidenceBundle['artifactHashes'] {
  return [...run.generatedArtifacts]
    .map((artifact) => ({
      artifactId: artifact.artifactId,
      artifactClass: artifact.artifactType,
      filePath: normalizePath(artifact.filePath),
      contentHash: artifact.contentHash,
    }))
    .sort((left, right) => left.artifactId.localeCompare(right.artifactId));
}

export function derivePromptHash(packet: Pick<CodexExecutionPacket, 'promptTemplate'>): string {
  return sha256(canonicalStringify({
    promptTemplate: packet.promptTemplate,
  }));
}

export function deriveExecutionPlanHash(run: Pick<BuildExecutionRun, 'executionPlan'>): string {
  return sha256(canonicalStringify({
    executionPlan: {
      steps: [...run.executionPlan.steps]
        .map((step) => ({
          stepId: step.stepId,
          operationType: step.operationType,
          targetPath: normalizePath(step.targetPath),
          promptTemplate: step.promptTemplate,
          expectedArtifacts: [...step.expectedArtifacts].sort((left, right) => left.localeCompare(right)),
        }))
        .sort((left, right) => left.stepId.localeCompare(right.stepId)),
    },
  }));
}

export function buildEvidenceBundleFromExecution(input: {
  run: Pick<BuildExecutionRun, 'runId' | 'packetId' | 'bundleId' | 'executionPlan' | 'generatedArtifacts'>;
  packet: Pick<CodexExecutionPacket, 'promptTemplate'>;
  bundle: Pick<RepositoryScaffoldBundle, 'bundleId'>;
}): BuildEvidenceBundle {
  const artifactHashes = deriveArtifactHashes(input.run);
  const promptHash = derivePromptHash(input.packet);
  const executionPlanHash = deriveExecutionPlanHash(input.run);

  const buildEvidenceBundleId = deriveBuildEvidenceBundleId({
    runId: input.run.runId,
    packetId: input.run.packetId,
    bundleId: input.bundle.bundleId,
    promptHash,
    executionPlanHash,
    artifactHashes,
  });

  return {
    buildEvidenceBundleId,
    runId: input.run.runId,
    packetId: input.run.packetId,
    bundleId: input.bundle.bundleId,
    promptHash,
    executionPlanHash,
    artifactHashes,
    verificationStatus: 'created',
    outcome: 'inconclusive',
  };
}
