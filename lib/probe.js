/**
  * Credential-free connector probe: schema/secret/uniqueness checks, endpoint initialize, OAuth metadata and icons.
  * It only reads public endpoints, never registers an OAuth client, and never triggers a real authorization.
 */
import { auditDescriptor, auditRawDescriptor } from './catalog.js';
import { normalizeConnectorDescriptor } from './schema.js';
import { discoverProtectedResource, discoverServerMetadata } from './oauth.js';
import { assertSafeUrl } from './util.js';
import { MCP_PROTOCOL_VERSION } from './constants.js';

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

function parseMcpPayload(text, contentType) {
  if (contentType.includes('text/event-stream')) {
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue;
      try { return JSON.parse(line.slice(5).trim()); } catch {}
    }
    return undefined;
  }
  try { return JSON.parse(text); } catch { return undefined; }
}

function probeErrorChain(error) {
  const entries = [];
  let current = error;
  for (let depth = 0; current && depth < 8; depth += 1) {
    entries.push({
      code: typeof current.code === 'string' ? current.code.toUpperCase() : '',
      name: typeof current.name === 'string' ? current.name : '',
      message: typeof current.message === 'string' ? current.message : '',
    });
    current = current.cause;
  }
  return entries;
}

/**
  * Turn nested fetch/undici errors into a stable diagnostic that contains no endpoint parameters or credentials.
  * The health report exposes only an error category and an allowlisted system error code.
 */
export function classifyProbeError(error) {
  const entries = probeErrorChain(error);
  const text = entries.flatMap((entry) => [entry.code, entry.name, entry.message]).join(' ');
  const code = entries.map((entry) => entry.code).find((value) => [
    'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED',
    'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_TLS_CERT_ALTNAME_INVALID',
  ].includes(value));

  if (/AbortError|timeout|timed out|ETIMEDOUT/i.test(text)) {
    return { kind: 'timeout', ...(code ? { code } : {}), message: code ? `Request timed out (${code})` : 'Request timed out' };
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(text)) {
    return { kind: 'dns', ...(code ? { code } : {}), message: code ? `DNS lookup failed (${code})` : 'DNS lookup failed' };
  }
  if (/CERT_|certificate|self signed|ERR_TLS|TLS|SSL/i.test(text)) {
    return { kind: 'tls', ...(code ? { code } : {}), message: code ? `TLS validation failed (${code})` : 'TLS validation failed' };
  }
  if (/ECONNRESET|socket disconnected|connection reset/i.test(text)) {
    return { kind: 'connection-reset', ...(code ? { code } : {}), message: code ? `Connection reset (${code})` : 'Connection reset' };
  }
  if (/ECONNREFUSED/i.test(text)) {
    return { kind: 'connection-refused', ...(code ? { code } : {}), message: code ? `Connection refused (${code})` : 'Connection refused' };
  }
  return { kind: 'network', message: 'Network request failed' };
}

async function probeServer(server, authMode, timeoutMs) {
  const startedAt = Date.now();
  if (server.transport === 'stdio') {
    return {
      serverKey: server.serverKey,
      serverName: server.serverName,
      transport: 'stdio',
      reachable: null,
      mcp: null,
      oauth: 'not-required',
      tools: [],
      skipped: 'The stdio catalog probe does not run local commands; after installation dsh-mcp-client starts it and registers the tools',
      durationMs: Date.now() - startedAt,
    };
  }
  const result = {
    serverKey: server.serverKey,
    serverName: server.serverName,
    url: server.url,
    reachable: false,
    mcp: false,
    oauth: authMode !== 'oauth2-pkce' ? 'not-required' : 'unchecked',
    tools: [],
  };
  try {
    const response = await fetchWithTimeout(server.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'dsh-mcp-connector-probe', version: '1.0' },
        },
      }),
    }, timeoutMs);
    result.httpStatus = response.status;
    result.reachable = response.status !== 404 && response.status < 500;
    const text = await response.text();
    const payload = parseMcpPayload(text, response.headers.get('content-type') ?? '');
    result.mcp = response.status === 401 || response.status === 403 || response.status === 405 || response.status === 406
      || payload?.jsonrpc === '2.0' || !!payload?.result?.protocolVersion || !!payload?.error;
    if (payload?.result?.tools) result.tools = payload.result.tools;
  } catch (error) {
    const diagnostic = classifyProbeError(error);
    result.error = diagnostic.message;
    result.errorKind = diagnostic.kind;
    if (diagnostic.code) result.errorCode = diagnostic.code;
  }

  if (authMode === 'oauth2-pkce' && result.reachable) {
    try {
      const resource = await discoverProtectedResource(server.url, timeoutMs);
      const issuer = resource.authorizationServers[0];
      const metadata = await discoverServerMetadata(issuer, timeoutMs);
      result.oauth = 'pass';
      result.oauthMetadata = {
        issuer: metadata.issuer,
        authorizationEndpoint: metadata.authorizationEndpoint,
        tokenEndpoint: metadata.tokenEndpoint,
        registrationEndpoint: metadata.registrationEndpoint,
        revocationEndpoint: metadata.revocationEndpoint,
      };
    } catch (error) {
      result.oauth = 'fail';
      result.oauthError = error instanceof Error ? error.message : String(error);
    }
  }
  result.durationMs = Date.now() - startedAt;
  return result;
}

async function probeIcon(icon, timeoutMs) {
  if (!icon || icon.startsWith('/') || icon.startsWith('data:image/')) return { ok: true, kind: 'bundled' };
  if (!/^https?:\/\//i.test(icon)) return { ok: true, kind: 'text' };
  try {
    assertSafeUrl(icon);
    let response = await fetchWithTimeout(icon, { method: 'HEAD' }, timeoutMs);
    assertSafeUrl(response.url || icon);
    if (response.status === 405) {
      response = await fetchWithTimeout(icon, { method: 'GET' }, timeoutMs);
      assertSafeUrl(response.url || icon);
    }
    return { ok: response.ok, status: response.status };
  } catch (error) {
    const diagnostic = classifyProbeError(error);
    return {
      ok: false,
      error: diagnostic.message,
      errorKind: diagnostic.kind,
      ...(diagnostic.code ? { errorCode: diagnostic.code } : {}),
    };
  }
}

export function validateRegistryDescriptors(rawList) {
  if (!Array.isArray(rawList)) throw new Error('registry connectors must be an array');
  const ids = new Set();
  const serverNames = new Set();
  return rawList.map((raw, index) => {
    const descriptor = auditDescriptor(normalizeConnectorDescriptor(auditRawDescriptor(raw, `connectors[${index}]`)));
    if (ids.has(descriptor.id)) throw new Error(`Duplicate connector id: ${descriptor.id}`);
    ids.add(descriptor.id);
    for (const server of descriptor.servers) {
      if (serverNames.has(server.serverName)) throw new Error(`Duplicate serverName: ${server.serverName}`);
      serverNames.add(server.serverName);
    }
    return descriptor;
  });
}

export async function probeConnector(raw, { timeoutMs = 15_000 } = {}) {
  const checkedAt = Date.now();
  let descriptor;
  try {
    descriptor = validateRegistryDescriptors([raw])[0];
  } catch (error) {
    return {
      id: raw?.id ?? '(unknown)',
      status: 'fail',
      checkedAt,
      errors: [error instanceof Error ? error.message : String(error)],
      servers: [],
    };
  }

  const servers = [];
  for (const server of descriptor.servers) {
    servers.push(await probeServer(server, descriptor.auth.mode, timeoutMs));
  }
  const icon = await probeIcon(descriptor.icon, timeoutMs);
  const hardFailures = servers.filter((server) => server.transport !== 'stdio' && (!server.reachable || !server.mcp));
  const oauthFailures = servers.filter((server) => server.oauth === 'fail');
  const status = hardFailures.length > 0 ? 'fail' : oauthFailures.length > 0 || !icon.ok ? 'partial' : 'pass';
  const toolsSnapshot = servers
    .filter((server) => server.tools.length > 0)
    .map((server) => ({
      serverKey: server.serverKey,
      serverName: server.serverName,
      tools: server.tools.map((tool) => ({ name: tool.name, title: tool.title, description: tool.description })),
    }));
  return {
    id: descriptor.id,
    status,
    checkedAt,
    durationMs: Date.now() - checkedAt,
    icon,
    servers,
    toolsSnapshot,
  };
}
