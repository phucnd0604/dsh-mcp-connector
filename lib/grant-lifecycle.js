/** OAuth grant refresh failure classification, log redaction and retry backoff. */

const PERMANENT_REFRESH_CODES = new Set([
  'invalid_grant',
  'invalid_token',
  'invalid_client',
  'unauthorized_client',
  'invalid_scope',
  'client_secret_expired',
  'missing_refresh_token',
]);

/** Prevents OAuth server error descriptions from echoing credentials back. */
export function redactOAuthDetail(value) {
  return String(value ?? '')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(/([?&](?:access_token|refresh_token|client_secret|code)=)[^&#\s]*/gi, '$1[REDACTED]')
    .replace(/((?:access_token|refresh_token|client_secret)\s*[=:]\s*)[^\s,;&}]+/gi, '$1[REDACTED]')
    .slice(0, 500);
}

/**
 * Only OAuth errors that clearly state the refresh token / dynamic client is unrecoverable require reauthorization.
 * Network, discovery endpoint, 5xx, timeout and unknown server errors are all retried automatically as transient failures.
 */
export function classifyRefreshFailure(error) {
  const code = typeof error?.code === 'string' && error.code
    ? redactOAuthDetail(error.code).slice(0, 80)
    : error?.name === 'OAuthNetworkError' ? 'network_error' : 'refresh_failed';
  const httpStatus = Number.isInteger(error?.httpStatus) ? error.httpStatus : undefined;
  const permanent = PERMANENT_REFRESH_CODES.has(code) || httpStatus === 401 || httpStatus === 403;
  return {
    permanent,
    kind: permanent ? 'permanent' : 'transient',
    code,
    httpStatus,
    message: redactOAuthDetail(error?.message || code),
  };
}

/** Exponential backoff: base, 2×, 4×…, capped at max. failureCount starts at 1. */
export function refreshRetryDelay(failureCount, baseMs, maxMs) {
  const base = Math.max(1_000, Number(baseMs) || 30_000);
  const max = Math.max(base, Number(maxMs) || 300_000);
  const exponent = Math.max(0, Math.min(20, Number(failureCount || 1) - 1));
  return Math.min(max, base * (2 ** exponent));
}
