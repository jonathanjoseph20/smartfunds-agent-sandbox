import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadWorkerRegistry } from '../../workers/worker-registry.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-task-workers-registry');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('worker registry', () => {
  it('T-TW-R1 loads worker definitions deterministically', () => {
    fs.mkdirSync(tmpRoot, { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'b.json'), JSON.stringify({
      workerId: 'w-b',
      workerType: 'local',
      supportedTaskTypes: ['shell'],
      capabilities: ['filesystem'],
      status: 'active',
    }));
    fs.writeFileSync(path.join(tmpRoot, 'a.json'), JSON.stringify({
      workerId: 'w-a',
      workerType: 'local',
      supportedTaskTypes: ['shell'],
      capabilities: ['filesystem', 'network'],
      status: 'active',
    }));

    const registry = loadWorkerRegistry({ definitionsDir: tmpRoot });
    expect(registry.listWorkers().map((worker) => worker.workerId)).toEqual(['w-a', 'w-b']);
  });

  it('T-TW-R2 validates task type and capability compatibility', () => {
    const registry = loadWorkerRegistry();

    expect(registry.validateWorkerSupportsTask('default-local-worker', 'shell')).toBe(true);
    expect(registry.validateWorkerSupportsTask('default-local-worker', 'unknown')).toBe(false);
    expect(registry.validateWorkerCapabilities('default-local-worker', ['filesystem'])).toBe(true);
    expect(registry.validateWorkerCapabilities('default-local-worker', ['gpu'])).toBe(false);
  });

  it('T-TW-R3 rejects invalid definitions', () => {
    fs.mkdirSync(tmpRoot, { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'invalid.json'), JSON.stringify({
      workerId: '',
      workerType: 'local',
      supportedTaskTypes: ['shell'],
      capabilities: ['filesystem'],
      status: 'active',
    }));

    expect(() => loadWorkerRegistry({ definitionsDir: tmpRoot })).toThrow(/WORKER_INVALID_DEFINITION/);
  });
});
