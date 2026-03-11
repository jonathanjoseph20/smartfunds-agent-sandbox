import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createSynthesisRegistry } from './synthesis-registry.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-synthesis-registry');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('synthesis registry', () => {
  it('T-SYN-R1 loads bounded definitions deterministically', () => {
    writeJson(path.join(tmpRoot, 'a.json'), {
      synthesisType: 'protocol-risk-synthesis',
      description: 'Protocol risk bounded synthesis.',
      supportedDimensions: ['protocol', 'signal_type'],
      sourceSignalTypes: ['protocol_risk'],
      sourceInvestigationDefinitionIds: ['protocol-risk-investigation']
    });

    const registry = createSynthesisRegistry({ definitionsDir: tmpRoot });
    const definitions = registry.listDefinitions();

    expect(definitions).toHaveLength(1);
    expect(definitions[0]?.synthesisType).toBe('protocol-risk-synthesis');
    expect(definitions[0]?.supportedDimensions).toEqual(['protocol', 'signal_type']);
  });
});
