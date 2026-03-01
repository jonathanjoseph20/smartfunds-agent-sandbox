export interface IngestedEvent {
  event_id: string;
  source: string;
  payload_canonical: string;
}

export type HandlerResult = {
  ok: boolean;
  code: string;
  summaryCanonical: string;
};

export interface ServiceHandler {
  handle(event: IngestedEvent): HandlerResult;
}
