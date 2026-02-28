import { EreborHandler } from './erebor.ts';
import { EvmHandler } from './evm.ts';
import { TestHandler } from './test.ts';
import type { ServiceHandler } from './types.ts';

export interface HandlerRoute {
  handlerName: string;
  handler: ServiceHandler;
}

const ROUTES: Record<string, HandlerRoute> = {
  test: {
    handlerName: 'TestHandler',
    handler: TestHandler
  },
  evm: {
    handlerName: 'EvmHandler',
    handler: EvmHandler
  },
  erebor: {
    handlerName: 'EreborHandler',
    handler: EreborHandler
  }
};

export function resolveHandlerRoute(source: string): HandlerRoute | null {
  return ROUTES[source] ?? null;
}
