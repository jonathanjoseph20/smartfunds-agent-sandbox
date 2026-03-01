import { canonicalStringify } from '../../finance/determinism.ts';

import type { HandlerResult, IngestedEvent, ServiceHandler } from './types.ts';

export const EvmHandler: ServiceHandler = {
  handle(event: IngestedEvent): HandlerResult {
    return {
      ok: true,
      code: 'stub_ok',
      summaryCanonical: canonicalStringify({
        source: event.source,
        event_id: event.event_id,
        note: 'stub'
      })
    };
  }
};
