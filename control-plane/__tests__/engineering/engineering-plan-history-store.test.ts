import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createEngineeringPlanHistoryStore } from '../../engineering/engineering-plan-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'engineering', 'tmp-engineering-plan-history');
const historyFilePath = path.join(tmpRoot, 'history.json');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('engineering plan history store', () => {
  it('T-PF2-H1 appends deterministically and dedupes identical events', () => {
    const store = createEngineeringPlanHistoryStore({ historyFilePath });

    const first = store.appendEngineeringPlanEvent({
      eventType: 'engineering_plan_created',
      planId: 'plan-1',
      payloadHash: 'aaa',
    });

    const duplicate = store.appendEngineeringPlanEvent({
      eventType: 'engineering_plan_created',
      planId: 'plan-1',
      payloadHash: 'aaa',
    });

    const second = store.appendEngineeringPlanEvent({
      eventType: 'engineering_plan_validated',
      planId: 'plan-1',
      payloadHash: 'bbb',
    });

    expect(first.appended).toBe(true);
    expect(duplicate.appended).toBe(false);
    expect(second.appended).toBe(true);

    expect(store.listEngineeringPlanEvents('plan-1')).toEqual([
      {
        eventType: 'engineering_plan_created',
        planId: 'plan-1',
        payloadHash: 'aaa',
      },
      {
        eventType: 'engineering_plan_validated',
        planId: 'plan-1',
        payloadHash: 'bbb',
      },
    ]);
  });
});
