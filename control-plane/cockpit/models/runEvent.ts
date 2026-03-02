export interface RunEvent {
  runId: string;
  attemptIndex: number;
  eventSeq: number;
  type: string;
  payloadJson: string | null;
  envelopeHash: string | null;
}
