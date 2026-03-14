import { sha256 } from '../finance/determinism.ts';

import { deriveGeneratedArtifactId } from './build-execution-identity.ts';
import type {
  ArtifactType,
  ExecutionStep,
  GeneratedArtifact,
  ValidationResult,
} from './build-execution-types.ts';

export type NormalizedGeneratedOutput = {
  artifactType: ArtifactType;
  filePath: string;
  content: string;
};

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

function normalizeContent(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function inferArtifactTypeFromPath(filePath: string): ArtifactType {
  const normalized = normalizePath(filePath).toLowerCase();

  if (normalized.endsWith('.patch') || normalized.endsWith('.diff')) {
    return 'patch';
  }
  if (normalized.includes('/tests/') || normalized.startsWith('tests/') || normalized.includes('.test.')) {
    return 'testFile';
  }
  if (normalized.startsWith('config/') || normalized.includes('/config/')) {
    return 'configFile';
  }
  if (normalized.startsWith('docs/') || normalized.includes('/docs/') || normalized.endsWith('.md')) {
    return 'docFile';
  }

  return 'sourceFile';
}

export function normalizeGeneratedOutputs(outputs: Array<{
  artifactType?: ArtifactType;
  filePath: string;
  content: unknown;
}>): NormalizedGeneratedOutput[] {
  return outputs
    .map((entry) => ({
      artifactType: entry.artifactType ?? inferArtifactTypeFromPath(entry.filePath),
      filePath: normalizePath(entry.filePath),
      content: normalizeContent(entry.content),
    }))
    .sort((left, right) => {
      const byPath = left.filePath.localeCompare(right.filePath);
      if (byPath !== 0) {
        return byPath;
      }
      return left.artifactType.localeCompare(right.artifactType);
    });
}

export function toGeneratedArtifacts(outputs: NormalizedGeneratedOutput[]): GeneratedArtifact[] {
  return outputs
    .map((output) => {
      const contentHash = sha256(output.content);
      const contentSize = Buffer.byteLength(output.content, 'utf8');
      const artifactId = deriveGeneratedArtifactId({
        artifactType: output.artifactType,
        filePath: output.filePath,
        contentHash,
      });

      return {
        artifactId,
        artifactType: output.artifactType,
        filePath: output.filePath,
        contentHash,
        contentSize,
      };
    })
    .sort((left, right) => left.artifactId.localeCompare(right.artifactId));
}

export function validateExpectedArtifacts(input: {
  steps: ExecutionStep[];
  generatedArtifacts: GeneratedArtifact[];
}): ValidationResult {
  const expected = input.steps
    .flatMap((step) => step.expectedArtifacts)
    .sort((left, right) => left.localeCompare(right));
  const generated = input.generatedArtifacts
    .map((artifact) => artifact.artifactType)
    .sort((left, right) => left.localeCompare(right));

  const missingFields: string[] = [];
  const violations: string[] = [];
  const warnings: string[] = [];

  if (input.steps.length === 0) {
    missingFields.push('executionPlan.steps');
  }

  if (generated.length === 0) {
    violations.push('generated_artifacts_empty');
  }

  for (const expectedType of expected) {
    if (!generated.includes(expectedType)) {
      violations.push(`missing_expected_artifact_type:${expectedType}`);
    }
  }

  for (const generatedType of generated) {
    if (!expected.includes(generatedType)) {
      warnings.push(`unexpected_generated_artifact_type:${generatedType}`);
    }
  }

  const uniqueMissing = Array.from(new Set(missingFields)).sort((left, right) => left.localeCompare(right));
  const uniqueViolations = Array.from(new Set(violations)).sort((left, right) => left.localeCompare(right));
  const uniqueWarnings = Array.from(new Set(warnings)).sort((left, right) => left.localeCompare(right));

  if (uniqueMissing.length > 0 || uniqueViolations.length > 0) {
    return {
      validationState: 'invalid',
      missingFields: uniqueMissing,
      violations: uniqueViolations,
      warnings: uniqueWarnings,
    };
  }

  if (uniqueWarnings.length > 0) {
    return {
      validationState: 'warning',
      missingFields: uniqueMissing,
      violations: uniqueViolations,
      warnings: uniqueWarnings,
    };
  }

  return {
    validationState: 'valid',
    missingFields: uniqueMissing,
    violations: uniqueViolations,
    warnings: uniqueWarnings,
  };
}
