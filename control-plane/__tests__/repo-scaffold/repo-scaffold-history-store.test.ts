import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createRepoScaffoldHistoryStore } from '../../repo-scaffold/repo-scaffold-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'repo-scaffold', 'tmp-repo-scaffold-history');
const historyFilePath = path.join(tmpRoot, 'history.json');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('repo scaffold history store', () => {
  it('T-PF5-H1 append-only behavior and dedupe', () => {
    const store = createRepoScaffoldHistoryStore({ historyFilePath });

    const first = store.appendRepoScaffoldEvent({
      bundleId: 'bundle-1',
      eventType: 'repo_scaffold_created',
      payloadHash: 'aaa',
      payload: { bundleId: 'bundle-1' },
    });

    const duplicate = store.appendRepoScaffoldEvent({
      bundleId: 'bundle-1',
      eventType: 'repo_scaffold_created',
      payloadHash: 'aaa',
      payload: { bundleId: 'bundle-1' },
    });

    const second = store.appendRepoScaffoldEvent({
      bundleId: 'bundle-1',
      eventType: 'repo_scaffold_validated',
      payloadHash: 'bbb',
      payload: { validationState: 'valid' },
    });

    expect(first.appended).toBe(true);
    expect(duplicate.appended).toBe(false);
    expect(second.appended).toBe(true);

    const entries = store.listRepoScaffoldEvents('bundle-1');
    expect(entries).toEqual([
      {
        bundleId: 'bundle-1',
        eventType: 'repo_scaffold_created',
        payloadHash: 'aaa',
        payload: { bundleId: 'bundle-1' },
      },
      {
        bundleId: 'bundle-1',
        eventType: 'repo_scaffold_validated',
        payloadHash: 'bbb',
        payload: { validationState: 'valid' },
      },
    ]);

    const reloaded = createRepoScaffoldHistoryStore({ historyFilePath });
    expect(reloaded.listRepoScaffoldEvents('bundle-1')).toEqual(entries);
  });
});
