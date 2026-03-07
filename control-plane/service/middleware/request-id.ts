export interface RequestContext {
  requestId: string;
  method: string;
  pathname: string;
  headers: Record<string, string | undefined>;
}

export function createRequestIdAllocator(prefix = 'req'): () => string {
  let counter = 0;

  return () => {
    counter += 1;
    return `${prefix}-${String(counter).padStart(6, '0')}`;
  };
}
