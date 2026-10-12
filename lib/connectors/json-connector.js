/**
  * Channel three: paste a JSON config (accepts both { mcpServers: {...} } and { connections: [...] }).
  * Pre-validates the whole batch and supports HTTP/SSE and stdio (command/args/env/cwd).
 */
import { JSON_CONNECTOR_ID } from '../constants.js';
import { assertConnectionUrl, assertSafeHeaderName, isPrivateNetworkHost, slugServerName } from '../util.js';
import { unresolvedRedactions } from '../connection-backup.js';
import { normalizeInjectionMode } from '../session-injection.js';

function parseInput(input) {
  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch (error) {
            throw new Error(`failed to parse JSON: ${error.message}`);
    }
  }
  return input;
}

function coerceHeaders(headers) {
  const out = {};
  for (const [key, value] of Object.entries(headers ?? {})) out[assertSafeHeaderName(key)] = String(value);
  return out;
}

function coerceEnv(env) {
  const out = {};
  for (const [key, value] of Object.entries(env ?? {})) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error(`invalid environment variable name: ${key}`);
    out[key] = String(value);
  }
  return out;
}

function normalizeTransport(value, hasCommand = false) {
  const raw = value ?? (hasCommand ? 'stdio' : 'streamable-http');
  if (raw === 'sse' || raw === 'http') return 'streamable-http';
  if (raw === 'streamable-http' || raw === 'stdio') return raw;
  throw new Error(`unsupported transport: ${raw}`);
}

function normalizeHttpEndpoint(rawUrl, allowInsecurePrivateNetwork) {
  const approved = allowInsecurePrivateNetwork === true;
  const url = assertConnectionUrl(rawUrl, { allowInsecurePrivateNetwork: approved });
  return {
    url: url.toString(),
    ...(approved && url.protocol === 'http:' && isPrivateNetworkHost(url.hostname)
      ? { allowInsecurePrivateNetwork: true }
      : {}),
  };
}

function stdioRecord(name, cfg) {
  const command = String(cfg.command ?? '').trim();
  if (!command) return null;
    if (cfg.args !== undefined && !Array.isArray(cfg.args)) throw new Error(`${name}: args must be an array of strings`);
  const serverName = slugServerName(cfg.serverName ?? name);
  return {
    key: `json-${serverName}`,
    connectorId: JSON_CONNECTOR_ID,
    kind: 'json',
    name: cfg.name ?? name,
    transport: 'stdio',
    command,
    args: (cfg.args ?? []).map((value) => String(value)),
    env: coerceEnv(cfg.env),
    cwd: String(cfg.cwd ?? '').trim(),
    serverName,
    headers: {},
    auth: undefined,
    enabled: cfg.enabled !== false,
    injectionMode: normalizeInjectionMode(cfg.injectionMode),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Promote Authorization: Bearer ... from the static headers to auth.bearer, and keep the rest as static headers */
function extractAuth(headers) {
  const h = coerceHeaders(headers);
  const authKey = Object.keys(h).find((k) => k.toLowerCase() === 'authorization');
  if (authKey && /^Bearer\s+(.+)$/i.test(h[authKey])) {
    const token = h[authKey].replace(/^Bearer\s+/i, '');
    delete h[authKey];
    return { auth: { mode: 'bearer', bearerToken: token }, headers: h };
  }
  return { auth: undefined, headers: h };
}

function authFromFields(item) {
  const authMode = item.authMode ?? 'none';
  if (authMode === 'bearer') {
    return { mode: 'bearer', bearerToken: String(item.bearerToken ?? '') };
  }
  if (authMode === 'api-key') {
    return {
      mode: 'api-key',
      apiKeyHeader: assertSafeHeaderName(item.apiKeyHeader ?? 'X-Api-Key'),
      apiKeyValue: String(item.apiKeyValue ?? ''),
    };
  }
  if (authMode === 'none') return undefined;
  throw new Error(`unsupported authMode: ${authMode}`);
}

/**
 * @param {string|object} input
 * @returns {{ records: object[], skipped: string[] }}
 */
export function normalizeJsonImport(input) {
  const obj = parseInput(input);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('the top level of the JSON must be an object');

  const unresolved = unresolvedRedactions(obj);
  if (unresolved.length) {
        const preview = unresolved.slice(0, 3).join(', ');
        throw new Error(`the redacted export still has ${unresolved.length} value(s) to fill in (${preview}${unresolved.length > 3 ? '…' : ''}); fill them in locally before importing`);
  }

  const records = [];
  const skipped = [];
  for (const item of Array.isArray(obj.oauthConnections) ? obj.oauthConnections : []) {
        skipped.push(`${item?.name || item?.connectorId || 'OAuth connection'} (needs to be re-authorized from the marketplace)`);
  }

  if (obj.mcpServers && typeof obj.mcpServers === 'object') {
    for (const [name, cfg] of Object.entries(obj.mcpServers)) {
      if (!cfg || typeof cfg !== 'object') {
        skipped.push(`${name} (invalid entry)`);
        continue;
      }
      const transport = normalizeTransport(cfg.transport ?? cfg.type, Boolean(cfg.command));
      if (transport === 'stdio') {
        const record = stdioRecord(name, cfg);
        if (record) records.push(record);
        else skipped.push(`${name} (stdio is missing command)`);
        continue;
      }
      if (!cfg.url) {
        skipped.push(`${name} (missing url)`);
        continue;
      }
      const { auth, headers } = extractAuth(cfg.headers ?? cfg.httpHeaders);
      const endpoint = normalizeHttpEndpoint(cfg.url, cfg.allowInsecurePrivateNetwork);
      records.push({
        key: `json-${slugServerName(cfg.serverName ?? name)}`,
        connectorId: JSON_CONNECTOR_ID,
        kind: 'json',
        name: cfg.name ?? name,
        transport,
        ...endpoint,
        serverName: slugServerName(cfg.serverName ?? name),
        headers,
        auth,
        enabled: cfg.enabled !== false,
        injectionMode: normalizeInjectionMode(cfg.injectionMode),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  } else if (Array.isArray(obj.connections)) {
    for (const item of obj.connections) {
      if (!item || typeof item !== 'object') {
        skipped.push('(invalid entry)');
        continue;
      }
      const name = String(item.name ?? item.serverName ?? '');
      if (!name) {
        skipped.push('(missing name/serverName)');
        continue;
      }
      const transport = normalizeTransport(item.transport, Boolean(item.command));
      if (transport === 'stdio') {
        const record = stdioRecord(name, item);
        if (record) records.push(record);
        else skipped.push(`${name} (stdio is missing command)`);
        continue;
      }
      if (!item.url) {
        skipped.push(`${name} (missing url)`);
        continue;
      }
      const endpoint = normalizeHttpEndpoint(item.url, item.allowInsecurePrivateNetwork);
      records.push({
        key: `json-${slugServerName(item.serverName ?? name)}`,
        connectorId: JSON_CONNECTOR_ID,
        kind: 'json',
        name,
        transport,
        ...endpoint,
        serverName: slugServerName(item.serverName ?? name),
        headers: coerceHeaders(item.headers),
        auth: authFromFields(item),
        enabled: item.enabled !== false,
        injectionMode: normalizeInjectionMode(item.injectionMode),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  } else {
        throw new Error('unsupported JSON format: expected { mcpServers: {...} } or { connections: [...] }');
  }

  if (records.length === 0) {
        throw new Error(`no importable connections${skipped.length ? ` (skipped: ${skipped.join(', ')})` : ''}`);
  }
  return { records, skipped };
}
