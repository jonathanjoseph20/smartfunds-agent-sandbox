import type { DatabaseSync } from 'node:sqlite';

export interface IngestedEvent {
  event_id: string;
  source: string;
  payload_canonical: string;
}

export interface HandlerContext {
  db: DatabaseSync;
  now: string;
}

export type HandlerResult = {
  ok: boolean;
  code: string;
  summaryCanonical: string;
  receiptId?: string;
  issuanceId?: string;
};

export interface ServiceHandler {
  handle(event: IngestedEvent, context: HandlerContext): HandlerResult;
}
