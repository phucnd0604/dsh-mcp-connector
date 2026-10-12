/**
  * MCP connectivity and credential validation before a connection is stored.
  * Auth headers are assembled in memory only and used for initialize; a failed validation never persists the connection or its credentials.
 */
import { MCP_PROTOCOL_VERSION } from './constants.js';
import { authHeaders } from './mcp-provision.js';
import { parseRetryAfter } from './discovery-policy.js';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

async function readLimitedText(response, maxBytes = MAX_RESPONSE_BYTES) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error('MCP response is too large');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error('MCP response is too large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function parseMcpPayload(text, contentType = '') {
  if (contentType.includes('text/event-stream')) {
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue;
      try { return JSON.parse(line.slice(5).trim()); } catch {}
    }
    return undefined;
  }
  try { return JSON.parse(text); } catch { return undefined; }
}

function errorChain(error) {
  const parts = [];
  let current = error;
  for (let depth = 0; current && depth < 8; depth += 1) {
    parts.push(current.code, current.name, current.message);
    current = current.cause;
  }
  return parts.filter(Boolean).join(' ');
}

export function classifyConnectionError(error, { transport } = {}) {
  const text = errorChain(error);
  if (text.includes('[CLI_AUTH_REQUIRED]')) {
    return { kind: 'authorization-required', message: 'DingTalk authorization is pending: the official CLI is not currently logged in. If your organization has not opened CLI access yet, wait for the administrator instead of repeatedly logging in, restarting, or entering an API key; complete the official login and connect once authorization is available' };
  }
  if (text.includes('[CLI_AUTH_STATUS_INVALID]')) {
    return { kind: 'authorization-unknown', message: 'DingTalk authorization status is unknown: the official CLI returned an abnormal or incomplete response, please check the CLI diagnostics; this alone does not indicate a logged-out state or an administrator restriction' };
  }
  if (/AbortError|timeout|timed out|ETIMEDOUT/i.test(text)) {
    return {
      kind: 'timeout',
      message: transport === 'stdio'
        ? 'The local MCP Server launch or tool synchronization timed out, please check the runtime environment, the command and the Host logs'
        : 'The connection timed out, please check the network, the VPN/dedicated line or the service status',
    };
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(text)) {
    return { kind: 'dns', message: 'Domain name resolution failed, please check the current network DNS' };
  }
  if (/ECONNRESET|ERR_SSL|TLS|certificate|socket disconnected|connection reset/i.test(text)) {
    return { kind: 'tls', message: 'The TLS/network connection was reset by the remote side; the service may require a dedicated line, a VPN or a source IP allowlist' };
  }
  if (/ECONNREFUSED/i.test(text)) {
    return { kind: 'refused', message: 'The target service refused the connection, please check the MCP URL and the service status' };
  }
  if (/ENOENT|command not found|spawn[^\n]*not found/i.test(text)) {
    return { kind: 'process-not-found', message: 'The local MCP launch command does not exist, please install the required runtime or check the command configuration' };
  }
  if (/exit(?:ed)?\s+(?:with\s+)?code|process[^\n]*(?:closed|exited)|subprocess[^\n]*(?:closed|exited)/i.test(text)) {
    const exitCode = text.match(/(?:exit(?:ed)?\s+(?:with\s+)?code|code)\s*[:=]?\s*(-?\d+)/i)?.[1];
    return {
      kind: 'process-exit',
      message: `The local MCP process exited during initialization${exitCode !== undefined ? ` (exit code ${exitCode})` : ''}, please check the command, the arguments and the Host logs`,
      ...(exitCode !== undefined ? { exitCode: Number(exitCode) } : {}),
    };
  }
  if (/initial (?:connection|tool synchronization)|tool synchronization failed|initialize(?: handshake)? failed/i.test(text)) {
    return { kind: 'startup', message: transport === 'stdio'
      ? 'Local MCP initialization or the first tool synchronization failed and the Host gave no recognizable specific reason; please check the official CLI status, the launch command and the Host logs, and do not conclude an authorization failure from this alone'
      : 'MCP initialization or the first tool synchronization failed, please check the service configuration and the Host logs' };
  }
  if (transport === 'stdio') {
    return { kind: 'startup', message: 'The local MCP Server launch or initialization failed, please check the command, the arguments, the runtime environment and the Host logs' };
  }
  return { kind: 'network', message: 'Unable to connect to the MCP service, please check the network and the MCP URL' };
}

function failed(record, kind, message, extra = {}) {
  return {
    ok: false,
    kind,
    serverKey: record.serverKey,
    serverName: record.serverName,
    message,
    ...extra,
  };
}

export async function validateConnectionRecord(record, { timeoutMs = 15_000, fetchImpl = fetch, grants = new Map() } = {}) {
  if (record.transport === 'stdio') {
    return {
      ok: true,
      kind: 'managed',
      serverKey: record.serverKey,
      serverName: record.serverName,
      message: 'The stdio process is now managed by dsh-mcp-client; tool availability follows the Host registration result',
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  try {
    const response = await fetchImpl(record.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...authHeaders(record, grants),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'dsh-mcp-connector', version: '1.0' },
        },
      }),
      signal: controller.signal,
      redirect: 'follow',
    });

    if (response.status === 401 || response.status === 403) {
      return failed(record, 'auth', `The key/token is invalid, expired, or the current account has no permission for this Server (HTTP ${response.status})`, { httpStatus: response.status });
    }
    if (response.status === 429) {
      return failed(record, 'rate-limit', 'The service is receiving too many requests (HTTP 429); try again later', { httpStatus: response.status, retryAfterMs: parseRetryAfter(response.headers.get('retry-after')) });
    }
    if (!response.ok) {
      const message = response.status >= 500
        ? `The MCP service is temporarily unavailable (HTTP ${response.status})`
        : `The MCP endpoint refused the connection (HTTP ${response.status})`;
      return failed(record, 'http', message, { httpStatus: response.status });
    }

    const text = await readLimitedText(response);
    const payload = parseMcpPayload(text, response.headers.get('content-type') ?? '');
    if (!payload || payload.jsonrpc !== '2.0') {
      return failed(record, 'protocol', 'The target address is reachable, but it did not return a valid MCP initialization response');
    }
    if (payload.error) {
      const rawMessage = String(payload.error.message ?? '').replace(/\s+/g, ' ').slice(0, 180);
      if (/unauthori[sz]ed|forbidden|invalid.?token|invalid.?key|credential|access.?denied|未授权|无权|密钥|令牌/i.test(rawMessage)) {
        return failed(record, 'auth', `The key/token is invalid or not permitted${rawMessage ? `: ${rawMessage}` : ''}`);
      }
      return failed(record, 'protocol', `MCP initialization failed${rawMessage ? `: ${rawMessage}` : ''}`);
    }
    const result = payload.result;
    if (!result || typeof result !== 'object' || !(result.protocolVersion || result.serverInfo || result.capabilities)) {
      return failed(record, 'protocol', 'The target address did not complete the MCP initialize handshake');
    }
    return {
      ok: true,
      kind: 'connected',
      serverKey: record.serverKey,
      serverName: record.serverName,
      httpStatus: response.status,
      protocolVersion: result.protocolVersion ?? '',
    };
  } catch (error) {
    const classified = classifyConnectionError(error);
    return failed(record, classified.kind, classified.message);
  } finally {
    clearTimeout(timer);
  }
}

export async function validateConnectionRecords(records, options = {}) {
  const concurrency = Math.max(1, Math.min(Number(options.concurrency) || records.length || 1, records.length || 1));
  const results = new Array(records.length);
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= records.length) return;
      results[index] = await validateConnectionRecord(records[index], options);
    }
  });
  await Promise.all(workers);
  const failures = results.filter((result) => !result.ok);
  if (failures.length === 0) {
    return { ok: true, message: `Validated ${results.length} MCP Server(s)`, detail: { results } };
  }
  const summary = failures.slice(0, 3).map((result) => `${result.serverName || result.serverKey || 'MCP Server'}: ${result.message}`).join('; ');
  const more = failures.length > 3 ? `; ${failures.length - 3} more Server(s) did not pass` : '';
  return {
    ok: false,
    message: `Connection validation failed: ${summary}${more}. No connection was saved, please fix the problem and retry.`,
    detail: { results },
  };
}
