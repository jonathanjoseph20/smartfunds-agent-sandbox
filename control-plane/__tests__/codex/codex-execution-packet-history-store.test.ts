import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCodexExecutionPacketHistoryStore } from '../../codex/codex-execution-packet-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'codex', 'tmp-codex-execution-packet-history');
const historyFilePath = path.join(tmpRoot, 'history.json');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('codex execution packet history store', () => {
  it('T-PF4-H1 append-only, payload-hash dedupe, deterministic ordering, replay-safe', () => {
    const store = createCodexExecutionPacketHistoryStore({ historyFilePath });

    const first = store.appendCodexExecutionPacketEvent({
      packetId: 'packet-1',
      eventType: 'codex_execution_packet_created',
      payloadHash: 'aaa',
      payload: { packetId: 'packet-1' },
    });

    const duplicate = store.appendCodexExecutionPacketEvent({
      packetId: 'packet-1',
      eventType: 'codex_execution_packet_created',
      payloadHash: 'aaa',
      payload: { packetId: 'packet-1' },
    });

    const second = store.appendCodexExecutionPacketEvent({
      packetId: 'packet-1',
      eventType: 'codex_execution_packet_validated',
      payloadHash: 'bbb',
      payload: { validationState: 'valid' },
    });

    expect(first.appended).toBe(true);
    expect(duplicate.appended).toBe(false);
    expect(second.appended).toBe(true);

    expect(store.listCodexExecutionPacketEvents('packet-1')).toEqual([
      {
        packetId: 'packet-1',
        eventType: 'codex_execution_packet_created',
        payloadHash: 'aaa',
        payload: { packetId: 'packet-1' },
      },
      {
        packetId: 'packet-1',
        eventType: 'codex_execution_packet_validated',
        payloadHash: 'bbb',
        payload: { validationState: 'valid' },
      },
    ]);

    const reloaded = createCodexExecutionPacketHistoryStore({ historyFilePath });
    expect(reloaded.listCodexExecutionPacketEvents('packet-1')).toEqual(store.listCodexExecutionPacketEvents('packet-1'));
    expect(reloaded.listAllCodexExecutionPacketEvents()).toEqual(store.listAllCodexExecutionPacketEvents());
  });
});
