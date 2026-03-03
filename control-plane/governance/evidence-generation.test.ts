import { describe, expect, it } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { stringifyEvidenceJson } from './evidence-contract.ts';
import {
  buildGovernanceMetadataSnapshot,
  generateEvidenceFromPullRequestMetadata
} from './evidence-generation.ts';

describe('governance evidence generation', () => {
  it('T-M1 produces deterministic evidence hash from identical labels/files', () => {
    const input = {
      labels: ['tier-3', 'codex'],
      changedFiles: ['b.ts', 'a.ts', 'a.ts']
    };
    const firstEvidence = generateEvidenceFromPullRequestMetadata(input);
    const secondEvidence = generateEvidenceFromPullRequestMetadata(input);

    const firstSnapshot = buildGovernanceMetadataSnapshot({
      pr: 70,
      labels: input.labels,
      files: input.changedFiles,
      evidence: firstEvidence
    });
    const secondSnapshot = buildGovernanceMetadataSnapshot({
      pr: 70,
      labels: input.labels,
      files: input.changedFiles,
      evidence: secondEvidence
    });

    expect(firstSnapshot.evidenceHash).toBe(secondSnapshot.evidenceHash);
    expect(canonicalStringify(firstEvidence)).toBe(canonicalStringify(secondEvidence));
  });

  it('T-M1 keeps canonical ordering stable for serialized evidence', () => {
    const evidence = generateEvidenceFromPullRequestMetadata({
      labels: ['tier-2'],
      changedFiles: ['control-plane/z.ts', 'control-plane/a.ts']
    });

    expect(stringifyEvidenceJson(evidence)).toBe(
      '{\n' +
        '  "affectedPaths": [\n' +
        '    "control-plane/a.ts",\n' +
        '    "control-plane/z.ts"\n' +
        '  ],\n' +
        '  "autonomyScopeExpanded": false,\n' +
        '  "determinismStatement": "Deterministic evidence generation from PR metadata using canonical JSON and stable ordering.",\n' +
        '  "mode": "structured",\n' +
        '  "retrySemanticsModified": false,\n' +
        '  "tier": 2\n' +
        '}\n'
    );
  });
});
