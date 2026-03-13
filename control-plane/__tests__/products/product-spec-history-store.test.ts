import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createProductSpecHistoryStore } from '../../products/product-spec-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'products', 'tmp-product-spec-history');
const historyFilePath = path.join(tmpRoot, 'history.json');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('product spec history store', () => {
  it('T-PF1-H1 appends deterministically and dedupes identical events', () => {
    const store = createProductSpecHistoryStore({ historyFilePath });

    const first = store.appendProductSpecEvent({
      eventType: 'product_spec_created',
      specId: 'spec-1',
      payloadHash: 'aaa',
    });

    const duplicate = store.appendProductSpecEvent({
      eventType: 'product_spec_created',
      specId: 'spec-1',
      payloadHash: 'aaa',
    });

    const second = store.appendProductSpecEvent({
      eventType: 'product_spec_validated',
      specId: 'spec-1',
      payloadHash: 'bbb',
    });

    expect(first.appended).toBe(true);
    expect(duplicate.appended).toBe(false);
    expect(second.appended).toBe(true);

    expect(store.listProductSpecEvents('spec-1')).toEqual([
      {
        eventType: 'product_spec_created',
        specId: 'spec-1',
        payloadHash: 'aaa',
      },
      {
        eventType: 'product_spec_validated',
        specId: 'spec-1',
        payloadHash: 'bbb',
      },
    ]);
  });
});
