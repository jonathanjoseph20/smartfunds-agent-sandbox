import { canonicalStringify } from '../../finance/determinism.ts';

export interface RequestLogEntry {
  requestId: string;
  method: string;
  pathname: string;
  statusCode: number;
}

export type RequestLogger = (entry: RequestLogEntry) => void;

export function createRequestLogger(write: (line: string) => void = (line) => process.stdout.write(line)): RequestLogger {
  return (entry) => {
    write(`${canonicalStringify(entry)}\n`);
  };
}
