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

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** True when the server/SDK string doesn’t explain what went wrong. */
function isVagueProviderText(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/^\d{3}\s+/, '');
  if (t.length === 0 || t.length < 3) return true;
  const vague = [
    'provider returned error',
    'provider returned an error',
    'an error occurred',
    'internal error',
    'unknown error',
    'error',
    'bad request',
    'status code (no body)',
    '(no status code or body)',
  ];
  return vague.some((v) => t === v || t.startsWith(`${v}.`) || t.includes(v));
}

/**
 * Logs the full error to the console (Metro / Xcode / Logcat). Call this for every
 * chat/provider failure so debugging doesn’t rely on shortened UI copy.
 */
export function logChatProviderError(error: unknown, context = 'chat-provider'): void {
  const tag = `[${context}]`;

  if (error instanceof APIError) {
    let headerDump: Record<string, string> | undefined;
    try {
      const h = error.headers as Headers | undefined;
      if (h && typeof h.entries === 'function') {
        headerDump = {};
        for (const [k, v] of h.entries()) {
          const lk = k.toLowerCase();
          if (
            lk.includes('request') ||
            lk.includes('retry') ||
            lk === 'content-type' ||
            lk === 'www-authenticate'
          ) {
            headerDump[k] = v;
          }
        }
      }
    } catch {
      headerDump = undefined;
    }

    console.error(tag, 'APIError', {
      constructor: error.constructor?.name,
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
      param: error.param,
      requestID: error.requestID,
      errorBody: error.error,
      errorBodyJson: safeJson(error.error),
      headers: headerDump,
    });
    return;
  }

  if (error instanceof Error) {
    const withCause = error as Error & { cause?: unknown };
    console.error(tag, 'Error', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: withCause.cause,
      causeJson:
        withCause.cause !== undefined ? safeJson(withCause.cause) : undefined,
    });
    return;
  }

  console.error(tag, 'Non-Error throw', {
    value: error,
    json: safeJson(error),
  });
}

/** True if text looks like JSON or a structured dump — never show that in the chat UI. */
function isLikelyJsonOrCodeDump(text: string): boolean {
  const t = text.trim();
  if (t.length > 240) return true;
  if (/^\s*[\[{]/.test(t) && /["']?\s*:\s*/.test(t)) return true;
  if (t.includes('{') && t.includes('}') && t.includes('"')) return true;
  return false;
}

/**
 * True when provider/SDK text must not be shown in chat (env names, keys, auth headers, etc.).
 * Full text is still logged via {@link logChatProviderError}.
 */
function isSensitiveForUserChat(text: string): boolean {
  const t = text;
  if (/EXPO_PUBLIC_[A-Z0-9_]+/i.test(t)) return true;
  if (
    /OPENROUTER_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|SUPABASE_[A-Z0-9_]+/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/\b\.env\b/i.test(t)) return true;
  if (/process\.env/i.test(t)) return true;
  if (/\bsk-[a-zA-Z0-9_-]{8,}\b/.test(t)) return true;
  if (/\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\./.test(t)) return true;
  if (/\bBearer\s+[A-Za-z0-9._~-]+\b/i.test(t)) return true;
  if (/api[_-]?key\s*[:=]\s*[^\s"'<>]{4,}/i.test(t)) return true;
  if (/authorization\s*:\s*[^\s]+/i.test(t)) return true;
  if (/x-api-key\s*[:=]\s*[^\s]+/i.test(t)) return true;
  if (/\bBasic\s+[A-Za-z0-9+/=]{12,}\b/i.test(t)) return true;
  // Avoid leaking local file paths from SDK / runtime errors in chat.
  if (/\/Users\//.test(t) || /\/home\/[^/\s"']+\//i.test(t)) return true;
  if (/\b[a-z]:\\Users\\/i.test(t)) return true;
  return false;
}

/** Redact token-like substrings so accidental leaks never reach the chat UI. */
function redactSensitiveForUserChat(text: string): string {
  return text
    .replace(/\bsk-[a-zA-Z0-9_-]{8,}\b/gi, '[key]')
    .replace(/\bBearer\s+[A-Za-z0-9._~-]+\b/gi, 'Bearer [key]')
    .replace(/\bBasic\s+[A-Za-z0-9+/=]{12,}\b/gi, 'Basic [redacted]')
    .replace(
      /([?&])(api[_-]?key|access[_-]?token|token|secret|password)=([^&\s]+)/gi,
      '$1$2=[redacted]',
    )
    .trim();
}

/**
 * Provider-supplied or SDK error text safe to show in chat: not vague, not JSON, not sensitive.
 */
function userSafeErrorFragment(
  text: string | undefined,
  maxLen: number,
): string | undefined {
  if (!text) return undefined;
  const t = text.trim();
  if (!t || isVagueProviderText(t) || isLikelyJsonOrCodeDump(t)) return undefined;
  if (isSensitiveForUserChat(t)) return undefined;
  const redacted = redactSensitiveForUserChat(t);
  if (!redacted || isSensitiveForUserChat(redacted)) return undefined;
  return redacted.length <= maxLen ? redacted : `${redacted.slice(0, maxLen - 1)}…`;
}

/**
 * A single human-readable line from the API error body for on-screen copy only.
 * Full JSON is logged via {@link logChatProviderError}; this must never return raw JSON.
 */
function humanLineFromApiErrorBody(body: ErrorBody): string | undefined {
  return userSafeErrorFragment(readNestedMessage(body), 200);
}

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
  // Some OpenAI-compatible providers surface cancellation as:
  // "stream was reset: CANCEL" / "reset: CANCEL" / "request cancelled"
  if (
    lower.includes('cancel') &&
    (lower.includes('stream') ||
      lower.includes('reset') ||
      lower.includes('request') ||
      lower.includes('user') ||
      lower.includes('abort'))
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
  logChatProviderError(error, 'getFriendlyChatProviderError');

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
    return 'The API returned “not found” (404). Check AI settings: use a full OpenAI-compatible base URL (OpenRouter: https://openrouter.ai/api/v1) and a model id from the model list.';
  }
  if (error instanceof RateLimitError) {
    const body = error.error as ErrorBody;
    const code =
      readErrorCode(body) ??
      (typeof error.code === 'string' ? error.code : undefined);
    if (code) {
      const fromCode = friendlyFromProviderCode(code);
      if (fromCode) return fromCode;
    }

    let retryAfter = '';
    try {
      const headers = error.headers as Headers | undefined;
      if (headers && typeof headers.get === 'function') {
        const ra = headers.get('retry-after');
        if (ra?.trim()) retryAfter = ` Retry after ${ra.trim()}s.`;
      }
    } catch {
      // ignore header parse issues
    }

    const detail429 = userSafeErrorFragment(readNestedMessage(body), 280);
    if (detail429) {
      return `${detail429}${retryAfter}`;
    }

    return (
      'Too many requests for your account or this model. ' +
      'Free models have low quotas—try another free model from the model list, wait, or add credits in your provider account. ' +
      'If several people share the same default key, add your own key in AI settings.' +
      retryAfter
    );
  }
  if (error instanceof BadRequestError) {
    const body = error.error as ErrorBody;
    const code = readErrorCode(body);
    const fromCode = code ? friendlyFromProviderCode(code) : undefined;
    if (fromCode) return fromCode;
    const detail400 = userSafeErrorFragment(readNestedMessage(body), 200);
    if (detail400) {
      return `The request was not accepted: ${detail400}`;
    }
    return 'The request was not accepted. Check your message, model, and AI settings.';
  }
  if (error instanceof UnprocessableEntityError) {
    const body = error.error as ErrorBody;
    const human422 = humanLineFromApiErrorBody(body);
    if (human422) {
      return `Could not process the request: ${human422}`;
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
      return 'The API returned “not found” (404). Check AI settings: OpenRouter base URL should be https://openrouter.ai/api/v1; pick a valid model from the chat model list.';
    }
    if (status === 429) {
      return 'Too many requests. Wait a moment and try again.';
    }
    if (typeof status === 'number' && status >= 500) {
      return 'The AI provider is having trouble. Try again shortly.';
    }

    const rawDetail = readNestedMessage(body);
    if (
      rawDetail &&
      !isVagueProviderText(rawDetail) &&
      !isLikelyJsonOrCodeDump(rawDetail)
    ) {
      const fromDetail = friendlyFromRawMessage(rawDetail);
      if (fromDetail) return fromDetail;
      const fromDetailCode = readErrorCode(body);
      if (fromDetailCode) {
        const f = friendlyFromProviderCode(fromDetailCode);
        if (f) return f;
      }
    }
    const detail = userSafeErrorFragment(rawDetail, 220);
    if (detail) {
      return detail;
    }

    const humanFallback = humanLineFromApiErrorBody(body);
    if (humanFallback) {
      const prefix =
        typeof status === 'number'
          ? `Something went wrong (HTTP ${status})`
          : 'Something went wrong';
      return `${prefix}. ${humanFallback}`;
    }

    if (typeof status === 'number') {
      return `Something went wrong (HTTP ${status}). Check AI settings (connection and model). For technical details, use the developer console.`;
    }

    if (typeof error.message === 'string' && error.message.trim()) {
      const fromMsg = friendlyFromRawMessage(error.message);
      if (fromMsg) return fromMsg;
      const safeMsg = userSafeErrorFragment(error.message, 220);
      if (safeMsg) return safeMsg;
    }
  }

  if (error instanceof Error) {
    const fromMsg = friendlyFromRawMessage(error.message);
    if (fromMsg) return fromMsg;
    if (error.name === 'AbortError') {
      return 'The request was cancelled.';
    }
    const safeMsg = userSafeErrorFragment(error.message, 220);
    if (safeMsg) return safeMsg;
  }

  return 'Something went wrong while getting a reply. Check AI settings and try again.';
}
