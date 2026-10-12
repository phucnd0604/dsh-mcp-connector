/**
  * Channel two: custom configuration connection (fill in transport/url/serverName/auth with a form).
 */
import { CUSTOM_CONNECTOR_ID } from '../constants.js';
import { assertConnectionUrl, assertSafeHeaderName, isPrivateNetworkHost, slugServerName } from '../util.js';
import { normalizeInjectionMode } from '../session-injection.js';

function parseHeadersJson(headersJson) {
  if (headersJson === undefined || headersJson === null || headersJson === '') return {};
  let obj;
  if (typeof headersJson === 'string') {
    try {
      obj = JSON.parse(headersJson);
    } catch {
            throw new Error('headersJson is not valid JSON');
    }
  } else {
    obj = headersJson;
  }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('headersJson must be a JSON object');
  const out = {};
  for (const [key, value] of Object.entries(obj)) out[assertSafeHeaderName(key)] = String(value);
  return out;
}

function parseEnvJson(envJson) {
  if (envJson === undefined || envJson === null || envJson === '') return {};
  let obj;
  if (typeof envJson === 'string') {
    try {
      obj = JSON.parse(envJson);
    } catch {
            throw new Error('envJson is not valid JSON');
    }
  } else {
    obj = envJson;
  }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('envJson must be a JSON object');
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error(`invalid environment variable name: ${key}`);
    out[key] = String(value);
  }
  return out;
}

/**
 * @param {object} params { name, url, transport?, serverName?, authMode?, bearerToken?, apiKeyHeader?, apiKeyValue?, headersJson?, allowInsecurePrivateNetwork? }
 */
export function buildManualRecord(params = {}) {
  const name = String(params.name ?? '').trim();
    if (!name) throw new Error('name is required');
  const serverName = slugServerName(params.serverName ?? name);
  const rawTransport = params.transport ?? 'streamable-http';
  const transport = rawTransport === 'sse' ? 'streamable-http' : rawTransport;
  if (!['streamable-http', 'stdio'].includes(transport)) throw new Error(`unsupported transport: ${rawTransport}`);

  if (transport === 'stdio') {
    const command = String(params.command ?? '').trim();
        if (!command) throw new Error('command is required when transport=stdio');
        if (params.authMode && params.authMode !== 'none') throw new Error('pass stdio credentials as environment variables through envJson');
        if (params.args !== undefined && !Array.isArray(params.args)) throw new Error('args must be an array of strings');
    const args = (params.args ?? []).map((value) => String(value));
    const env = parseEnvJson(params.envJson ?? params.env);
    return {
      key: `custom-${serverName}`,
      connectorId: CUSTOM_CONNECTOR_ID,
      kind: 'manual',
      name,
      transport,
      command,
      args,
      env,
      cwd: String(params.cwd ?? '').trim(),
      serverName,
      headers: {},
      auth: undefined,
      enabled: true,
      injectionMode: normalizeInjectionMode(params.injectionMode),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  const parsedUrl = assertConnectionUrl(params.url, {
    allowInsecurePrivateNetwork: params.allowInsecurePrivateNetwork === true,
  });
  const url = parsedUrl.toString();
  const allowInsecurePrivateNetwork = parsedUrl.protocol === 'http:'
    && isPrivateNetworkHost(parsedUrl.hostname)
    && params.allowInsecurePrivateNetwork === true;
  const headers = parseHeadersJson(params.headersJson);

  const authMode = params.authMode ?? 'none';
  let auth;
  if (authMode === 'bearer') {
        if (!params.bearerToken) throw new Error('bearerToken is required when authMode=bearer');
    auth = { mode: 'bearer', bearerToken: String(params.bearerToken) };
  } else if (authMode === 'api-key') {
    const apiKeyHeader = assertSafeHeaderName(params.apiKeyHeader ?? 'X-Api-Key');
        if (params.apiKeyValue === undefined || params.apiKeyValue === '') throw new Error('apiKeyValue is required when authMode=api-key');
    auth = { mode: 'api-key', apiKeyHeader, apiKeyValue: String(params.apiKeyValue) };
  } else if (authMode !== 'none') {
    throw new Error(`unsupported authMode: ${authMode}`);
  }

  return {
    key: `custom-${serverName}`,
    connectorId: CUSTOM_CONNECTOR_ID,
    kind: 'manual',
    name,
    transport,
    url,
    ...(allowInsecurePrivateNetwork ? { allowInsecurePrivateNetwork: true } : {}),
    serverName,
    headers,
    auth,
    enabled: true,
    injectionMode: normalizeInjectionMode(params.injectionMode),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
