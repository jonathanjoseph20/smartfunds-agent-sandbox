import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computeExecutionContractEventDedupeKey,
  createExecutionContractHistoryStore,
} from '../../execution-contract/execution-contract-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-execution-contract-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('execution contract history store', () => {
  it('T-MEC-H1 append-only behavior and dedupe are deterministic', () => {
    const store = createExecutionContractHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    const first = store.append({
      executionContractId: 'ec-1',
      missionId: 'mission-1',
      eventType: 'execution_contract_evaluated',
      reasoning: 'evaluated',
      payload: { state: 'evaluated' },
    });

    const second = store.append({
      executionContractId: 'ec-1',
      missionId: 'mission-1',
      eventType: 'execution_contract_evaluated',
      reasoning: 'evaluated',
      payload: { state: 'evaluated' },
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(second.history.entries).toHaveLength(1);
  });

  it('T-MEC-H2 ordering and repeated loads are stable', () => {
    const store = createExecutionContractHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    store.append({
      executionContractId: 'ec-1',
      missionId: 'mission-1',
      eventType: 'execution_contract_confirmed',
      reasoning: 'confirmed',
      payload: { reviewedBy: 'founder' },
    });

    store.append({
      executionContractId: 'ec-1',
      missionId: 'mission-1',
      eventType: 'execution_contract_materialized',
      reasoning: 'materialized',
      payload: {},
    });

    const first = store.load({ executionContractId: 'ec-1', missionId: 'mission-1' });
    const second = store.load({ executionContractId: 'ec-1', missionId: 'mission-1' });

    expect(first).toEqual(second);
    expect([...first.entries].sort((left, right) => left.eventDedupeKey.localeCompare(right.eventDedupeKey))).toEqual(first.entries);
  });

  it('T-MEC-H3 event dedupe key is deterministic', () => {
    const input = {
      executionContractId: 'ec-1',
      missionId: 'mission-1',
      eventType: 'execution_contract_rejected' as const,
      reasoning: 'rejected',
      payload: { reason: 'manual rejection' },
    };

    expect(computeExecutionContractEventDedupeKey(input)).toBe(computeExecutionContractEventDedupeKey(input));
  });

  it('T-MEC-H4 capture events without mutating source truth files', () => {
    const sourceFile = path.join(tmpRoot, 'source.json');
    fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
    fs.writeFileSync(sourceFile, '{"value":1}\n', 'utf8');
    const before = fs.readFileSync(sourceFile, 'utf8');

    const store = createExecutionContractHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    store.append({
      executionContractId: 'ec-1',
      missionId: 'mission-1',
      eventType: 'execution_contract_confirmed',
      reasoning: 'confirmed',
      payload: { reviewedBy: 'founder' },
    });

    store.append({
      executionContractId: 'ec-1',
      missionId: 'mission-1',
      eventType: 'execution_contract_rejected',
      reasoning: 'rejected',
      payload: { reason: 'manual rejection' },
    });

    const after = fs.readFileSync(sourceFile, 'utf8');
    expect(after).toBe(before);
  });
});
