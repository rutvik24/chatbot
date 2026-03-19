import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
} from 'openai';

type ErrorBody = Record<string, unknown> | undefined;

function readNestedMessage(body: ErrorBody): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const o = body as Record<string, unknown>;
  if (typeof o.message === 'string' && o.message.trim()) {
    return o.message.trim();
  }
  const inner = o.error;
  if (inner && typeof inner === 'object') {
    const m = (inner as Record<string, unknown>).message;
    if (typeof m === 'string' && m.trim()) return m.trim();
  }
  return undefined;
}

function readErrorCode(body: ErrorBody): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const o = body as Record<string, unknown>;
  if (typeof o.code === 'string' && o.code.trim()) return o.code.trim();
  const inner = o.error;
  if (inner && typeof inner === 'object') {
    const c = (inner as Record<string, unknown>).code;
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return undefined;
}

/** Map provider / SDK-specific codes to short, user-facing copy. */
function friendlyFromProviderCode(code: string): string | undefined {
  const c = code.toLowerCase();
  const map: Record<string, string> = {
    invalid_api_key:
      'Your API key was rejected. Open AI settings and check that your key is correct.',
    incorrect_api_key:
      'Your API key was rejected. Open AI settings and check that your key is correct.',
    insufficient_quota:
      'Your provider account is out of credits or quota. Add billing or credits, then try again.',
    rate_limit_exceeded:
      'Too many requests right now. Wait a short time and try again.',
    context_length_exceeded:
      'This conversation is too long for the model. Start a new chat or send a shorter message.',
    model_not_found:
      'That model is not available for your key or base URL. Check AI settings (model / endpoint).',
  };
  return map[c];
}

function friendlyFromRawMessage(raw: string): string | undefined {
  const lower = raw.toLowerCase();
  if (
    lower.includes('aborted') ||
    lower.includes('abort') ||
    lower === 'the user aborted a request.'
  ) {
    return 'The request was cancelled.';
  }
  if (
    lower.includes('network request failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed')
  ) {
    return 'Could not reach the AI service. Check your internet connection and base URL in AI settings.';
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'The request timed out. Check your connection and try again.';
  }
  return undefined;
}

/** Finish-reason errors exist in the SDK but are not re-exported from the main `openai` entry. */
function errorConstructorName(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const ctor = (error as { constructor?: { name?: string } }).constructor;
  return typeof ctor?.name === 'string' ? ctor.name : undefined;
}

/**
 * Turns OpenAI-compatible provider / SDK errors into short, user-facing text.
 */
export function getFriendlyChatProviderError(error: unknown): string {
  if (error instanceof APIUserAbortError) {
    return 'The request was cancelled.';
  }
  const ctorName = errorConstructorName(error);
  if (ctorName === 'LengthFinishReasonError') {
    return 'The reply was cut off because it hit the model length limit. Try asking for a shorter answer.';
  }
  if (ctorName === 'ContentFilterFinishReasonError') {
    return 'The model could not finish that reply (content policy). Try rephrasing your message.';
  }
  if (error instanceof APIConnectionTimeoutError) {
    return 'The connection timed out. Check your network and try again.';
  }
  if (error instanceof APIConnectionError) {
    return 'Could not reach the AI service. Check your internet connection and base URL in AI settings.';
  }
  if (error instanceof AuthenticationError) {
    return 'Your API key was rejected. Open AI settings and verify your key.';
  }
  if (error instanceof PermissionDeniedError) {
    return 'Access was denied. Your key may not be allowed to use this model or endpoint.';
  }
  if (error instanceof NotFoundError) {
    return 'The API returned “not found.” Check your base URL and model id in AI settings.';
  }
  if (error instanceof RateLimitError) {
    return 'Rate limit reached. Wait a bit and try again.';
  }
  if (error instanceof BadRequestError) {
    const detail = readNestedMessage(error.error as ErrorBody);
    const code = readErrorCode(error.error as ErrorBody);
    const fromCode = code ? friendlyFromProviderCode(code) : undefined;
    if (fromCode) return fromCode;
    if (detail && detail.length < 200) {
      return `The request was not accepted: ${detail}`;
    }
    return 'The request was not accepted. Check your message, model, and AI settings.';
  }
  if (error instanceof UnprocessableEntityError) {
    const detail = readNestedMessage(error.error as ErrorBody);
    if (detail && detail.length < 200) {
      return `Could not process the request: ${detail}`;
    }
    return 'Could not process the request. Check AI settings and try again.';
  }
  if (error instanceof InternalServerError) {
    return 'The AI provider had a temporary server error. Try again in a moment.';
  }

  if (error instanceof APIError) {
    const status = error.status;
    const body = error.error as ErrorBody;
    if (typeof error.code === 'string' && error.code.trim()) {
      const fromTop = friendlyFromProviderCode(error.code);
      if (fromTop) return fromTop;
    }
    const code = readErrorCode(body);
    const fromCode = code ? friendlyFromProviderCode(code) : undefined;
    if (fromCode) return fromCode;

    if (status === 401) {
      return 'Your API key was rejected. Open AI settings and verify your key.';
    }
    if (status === 402) {
      return 'Payment or credits are required on your provider account.';
    }
    if (status === 403) {
      return 'Access was denied. Check your API key permissions or model access.';
    }
    if (status === 404) {
      return 'The API path or model was not found. Check base URL and model in AI settings.';
    }
    if (status === 429) {
      return 'Too many requests. Wait a moment and try again.';
    }
    if (typeof status === 'number' && status >= 500) {
      return 'The AI provider is having trouble. Try again shortly.';
    }

    const detail = readNestedMessage(body);
    if (detail) {
      const fromDetail = friendlyFromRawMessage(detail);
      if (fromDetail) return fromDetail;
      const fromDetailCode = readErrorCode(body);
      if (fromDetailCode) {
        const f = friendlyFromProviderCode(fromDetailCode);
        if (f) return f;
      }
      if (detail.length <= 220) {
        return detail;
      }
    }

    if (typeof error.message === 'string' && error.message.trim()) {
      const fromMsg = friendlyFromRawMessage(error.message);
      if (fromMsg) return fromMsg;
      if (error.message.length <= 220) {
        return error.message.trim();
      }
    }
  }

  if (error instanceof Error) {
    const fromMsg = friendlyFromRawMessage(error.message);
    if (fromMsg) return fromMsg;
    if (error.name === 'AbortError') {
      return 'The request was cancelled.';
    }
    if (error.message.trim() && error.message.length <= 220) {
      return error.message.trim();
    }
  }

  return 'Something went wrong while getting a reply. Please try again.';
}
