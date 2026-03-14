import type { BuildExecutionRun } from '../build-runtime/build-execution-types.ts';

import { deriveArtifactVerificationId } from './build-evidence-identity.ts';
import type { ArtifactVerification } from './build-evidence-types.ts';

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

function expectedArtifactPath(targetPath: string, expectedIndex: number, artifactClass: string): string {
  if (expectedIndex === 0) {
    return normalizePath(targetPath);
  }

  return artifactClass === 'patch'
    ? `${normalizePath(targetPath)}.${artifactClass}.patch`
    : `${normalizePath(targetPath)}.${artifactClass}`;
}

function toState(verificationClass: ArtifactVerification['verificationClass']): ArtifactVerification['state'] {
  if (verificationClass === 'artifact_hash_verified') {
    return 'verified';
  }
  if (verificationClass === 'artifact_unexpected') {
    return 'blocked';
  }
  if (verificationClass === 'artifact_hash_mismatch' || verificationClass === 'artifact_missing') {
    return 'failed';
  }
  return 'inconclusive';
}

export function verifyArtifactsForBuildEvidence(input: {
  buildEvidenceBundleId: string;
  run: Pick<BuildExecutionRun, 'executionPlan' | 'generatedArtifacts'>;
  expectedArtifactHashes?: Record<string, string>;
}): ArtifactVerification[] {
  const expectedEntries = input.run.executionPlan.steps
    .flatMap((step) => [...step.expectedArtifacts]
      .sort((left, right) => left.localeCompare(right))
      .map((artifactClass, index) => ({
        artifactClass,
        filePath: expectedArtifactPath(step.targetPath, index, artifactClass),
      })))
    .sort((left, right) => {
      const byPath = left.filePath.localeCompare(right.filePath);
      if (byPath !== 0) {
        return byPath;
      }
      return left.artifactClass.localeCompare(right.artifactClass);
    });

  const actualByKey = new Map(
    [...input.run.generatedArtifacts]
      .sort((left, right) => left.artifactId.localeCompare(right.artifactId))
      .map((artifact) => {
        const key = `${normalizePath(artifact.filePath)}::${artifact.artifactType}`;
        return [key, artifact] as const;
      }),
  );

  const verifications: ArtifactVerification[] = [];

  for (const expected of expectedEntries) {
    const key = `${expected.filePath}::${expected.artifactClass}`;
    const actual = actualByKey.get(key);

    if (!actual) {
      const reasonTokens = ['artifact_missing'];
      const verificationClass = 'artifact_missing' as const;
      verifications.push({
        artifactVerificationId: deriveArtifactVerificationId({
          buildEvidenceBundleId: input.buildEvidenceBundleId,
          artifactId: key,
          artifactClass: expected.artifactClass,
          verificationClass,
          reasonTokens,
        }),
        buildEvidenceBundleId: input.buildEvidenceBundleId,
        artifactId: key,
        artifactClass: expected.artifactClass,
        verificationClass,
        reasonTokens,
        state: toState(verificationClass),
      });
      continue;
    }

    const expectedHash = input.expectedArtifactHashes?.[key];
    const verificationClass = !expectedHash
      ? 'artifact_inconclusive'
      : expectedHash === actual.contentHash
        ? 'artifact_hash_verified'
        : 'artifact_hash_mismatch';

    const reasonTokens = verificationClass === 'artifact_hash_verified'
      ? ['artifact_hash_verified']
      : verificationClass === 'artifact_hash_mismatch'
        ? ['artifact_hash_mismatch']
        : ['artifact_expected_hash_missing'];

    verifications.push({
      artifactVerificationId: deriveArtifactVerificationId({
        buildEvidenceBundleId: input.buildEvidenceBundleId,
        artifactId: actual.artifactId,
        artifactClass: actual.artifactType,
        verificationClass,
        reasonTokens,
      }),
      buildEvidenceBundleId: input.buildEvidenceBundleId,
      artifactId: actual.artifactId,
      artifactClass: actual.artifactType,
      verificationClass,
      reasonTokens,
      state: toState(verificationClass),
    });

    actualByKey.delete(key);
  }

  for (const unexpected of [...actualByKey.values()].sort((left, right) => left.artifactId.localeCompare(right.artifactId))) {
    const verificationClass = 'artifact_unexpected' as const;
    const reasonTokens = ['artifact_unexpected'];
    verifications.push({
      artifactVerificationId: deriveArtifactVerificationId({
        buildEvidenceBundleId: input.buildEvidenceBundleId,
        artifactId: unexpected.artifactId,
        artifactClass: unexpected.artifactType,
        verificationClass,
        reasonTokens,
      }),
      buildEvidenceBundleId: input.buildEvidenceBundleId,
      artifactId: unexpected.artifactId,
      artifactClass: unexpected.artifactType,
      verificationClass,
      reasonTokens,
      state: toState(verificationClass),
    });
  }

  if (verifications.length === 0) {
    const verificationClass = 'artifact_inconclusive' as const;
    const reasonTokens = ['artifact_set_empty'];
    verifications.push({
      artifactVerificationId: deriveArtifactVerificationId({
        buildEvidenceBundleId: input.buildEvidenceBundleId,
        artifactId: 'artifact-set',
        artifactClass: 'sourceFile',
        verificationClass,
        reasonTokens,
      }),
      buildEvidenceBundleId: input.buildEvidenceBundleId,
      artifactId: 'artifact-set',
      artifactClass: 'sourceFile',
      verificationClass,
      reasonTokens,
      state: toState(verificationClass),
    });
  }

  return verifications.sort((left, right) => left.artifactVerificationId.localeCompare(right.artifactVerificationId));
}
