import { DEFAULT_RUNTIME_SAFETY_LIMITS } from '../../runtime/safety-limits.ts';

export function createOperatorHandlers() {
  return {
    getRuntimeLimits: () => DEFAULT_RUNTIME_SAFETY_LIMITS
  };
}
