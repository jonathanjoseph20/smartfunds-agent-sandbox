import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createProductFactoryReleaseHistoryStore } from '../../product-factory-release/product-factory-release-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'product-factory-release', 'tmp-release-history');
const historyFilePath = path.join(tmpRoot, 'history.json');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('product factory release history store', () => {
  it('T-PF9-HS1 append-only and dedupe are deterministic', () => {
    const store = createProductFactoryReleaseHistoryStore({ historyFilePath });

    const first = store.appendProductFactoryReleaseEvent({
      productFactoryReleaseAcceptanceRecordId: 'release-1',
      releaseTrack: 'track-1',
      eventType: 'product_factory_release_acceptance_record_created',
      payloadHash: 'h1',
      payload: { ok: true },
    });

    const duplicate = store.appendProductFactoryReleaseEvent({
      productFactoryReleaseAcceptanceRecordId: 'release-1',
      releaseTrack: 'track-1',
      eventType: 'product_factory_release_acceptance_record_created',
      payloadHash: 'h1',
      payload: { ok: true },
    });

    const second = store.appendProductFactoryReleaseEvent({
      productFactoryReleaseAcceptanceRecordId: 'release-1',
      releaseTrack: 'track-1',
      eventType: 'product_factory_release_closed',
      payloadHash: 'h2',
      payload: { closed: true },
    });

    expect(first.appended).toBe(true);
    expect(duplicate.appended).toBe(false);
    expect(second.appended).toBe(true);

    const events = store.listProductFactoryReleaseEvents('release-1');
    expect(events).toHaveLength(2);

    const reloaded = createProductFactoryReleaseHistoryStore({ historyFilePath });
    expect(reloaded.listProductFactoryReleaseEvents('release-1')).toEqual(events);
  });
});
