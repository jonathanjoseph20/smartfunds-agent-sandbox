import fs from 'node:fs';

import { parseOrchestrationRegistryV1, type OrchestrationRegistryV1 } from './orchestration-schema.ts';

type OrchestrationRegistryLoadOk = {
  status: 'ok';
  registry: OrchestrationRegistryV1;
};

type OrchestrationRegistryLoadMissing = {
  status: 'missing_registry';
  errors: string[];
};

type OrchestrationRegistryLoadInvalid = {
  status: 'invalid_registry';
  errors: string[];
};

export type OrchestrationRegistryLoadResult =
  | OrchestrationRegistryLoadOk
  | OrchestrationRegistryLoadMissing
  | OrchestrationRegistryLoadInvalid;

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export function loadOrchestrationRegistryFromFile(filePath: string): OrchestrationRegistryLoadResult {
  if (!fs.existsSync(filePath)) {
    return {
      status: 'missing_registry',
      errors: ['orchestration.missing_registry: control-plane/swarms/orchestration.json']
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  } catch {
    return {
      status: 'invalid_registry',
      errors: ['orchestration.schema_invalid: file must contain valid JSON']
    };
  }

  const result = parseOrchestrationRegistryV1(parsed);
  if (!result.ok) {
    return {
      status: 'invalid_registry',
      errors: sortedUnique(result.errors)
    };
  }

  return {
    status: 'ok',
    registry: result.value
  };
}
