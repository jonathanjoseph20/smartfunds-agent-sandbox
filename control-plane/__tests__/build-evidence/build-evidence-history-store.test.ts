import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createBuildEvidenceHistoryStore } from '../../build-evidence/build-evidence-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'build-evidence', 'tmp-build-evidence-history');
const historyFilePath = path.join(tmpRoot, 'history.json');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('build evidence history store', () => {
  it('T-PF7-H1 append-only and dedupe are deterministic and replay-safe', () => {
    const store = createBuildEvidenceHistoryStore({ historyFilePath });

    const first = store.appendBuildEvidenceEvent({
      buildEvidenceBundleId: 'be-1',
      runId: 'run-1',
      eventType: 'build_evidence_bundle_created',
      payloadHash: 'h1',
      payload: { runId: 'run-1' },
    });

    const duplicate = store.appendBuildEvidenceEvent({
      buildEvidenceBundleId: 'be-1',
      runId: 'run-1',
      eventType: 'build_evidence_bundle_created',
      payloadHash: 'h1',
      payload: { runId: 'run-1' },
    });

    const second = store.appendBuildEvidenceEvent({
      buildEvidenceBundleId: 'be-1',
      runId: 'run-1',
      eventType: 'build_evidence_governance_validated',
      payloadHash: 'h2',
      payload: { status: 'verified' },
    });

    expect(first.appended).toBe(true);
    expect(duplicate.appended).toBe(false);
    expect(second.appended).toBe(true);

    const list = store.listBuildEvidenceEvents('be-1');
    expect(list).toHaveLength(2);

    const reloaded = createBuildEvidenceHistoryStore({ historyFilePath });
    expect(reloaded.listBuildEvidenceEvents('be-1')).toEqual(list);
  });
});
