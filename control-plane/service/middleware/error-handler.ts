export interface ErrorPayload {
  success: false;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}

function inferStatusCode(code: string): number {
  if (code.endsWith('_NOT_FOUND')) {
    return 404;
  }
  if (code.endsWith('_CONFLICT')) {
    return 409;
  }
  if (code.endsWith('_INVALID') || code.endsWith('_VALIDATION') || code === 'BAD_REQUEST') {
    return 400;
  }
  return 500;
}

export function toErrorResponse(error: unknown): { statusCode: number; payload: ErrorPayload } {
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
    const typed = error as { code: string; message: string; details?: Record<string, unknown>; statusCode?: number };
    return {
      statusCode: typed.statusCode ?? inferStatusCode(typed.code),
      payload: {
        success: false,
        error: {
          code: typed.code,
          message: typed.message,
          details: typed.details ?? {}
        }
      }
    };
  }

  if (error instanceof Error) {
    return {
      statusCode: 400,
      payload: {
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: error.message,
          details: {}
        }
      }
    };
  }

  return {
    statusCode: 500,
    payload: {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'internal_error',
        details: {}
      }
    }
  };
}
