import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type { SwarmRun } from './schema.ts';

export function computeSwarmRunHash(run: SwarmRun): string {
  return sha256(canonicalStringify(run));
}
