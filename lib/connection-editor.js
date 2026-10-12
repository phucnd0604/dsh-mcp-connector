/**
 * Safe editing view for user-defined / JSON connections.
 *
 * The browser only receives normalized JSON plus keep-existing-value markers; existing Token,
 * Header/env values, stdio arguments and local paths always stay inside the storage domain and are merged back locally on submit.
 */
import { CUSTOM_CONNECTOR_ID, JSON_CONNECTOR_ID } from './constants.js';
import { normalizeJsonImport } from './connectors/json-connector.js';
import { normalizeConnectionDisplayName } from './util.js';

export const KEEP_EXISTING_VALUE = '<KEEP_EXISTING>';

export function connectionConfigurationEditable(record) {
  return [CUSTOM_CONNECTOR_ID, JSON_CONNECTOR_ID].includes(record?.connectorId)
    && record?.auth?.mode !== 'oauth';
}

function keepObjectKeys(input, path, preservedFields) {
  const output = {};
  for (const key of Object.keys(input ?? {}).sort()) {
    output[key] = KEEP_EXISTING_VALUE;
    preservedFields.push(`${path}.${key}`);
  }
  return output;
}

function safeUrl(record, preservedFields) {
  try {
    const url = new URL(record.url);
    if (!url.username && !url.password && !url.search && !url.hash) return url.toString();
  } catch {}
  preservedFields.push('connections[0].url');
  return KEEP_EXISTING_VALUE;
}

function safeCommand(record, preservedFields) {
  const command = String(record.command ?? '');
  if (/^[A-Za-z0-9_.@+-]+$/.test(command)) return command;
  preservedFields.push('connections[0].command');
  return KEEP_EXISTING_VALUE;
}

/** Returns the normalized editable JSON of a single connection; never returns existing sensitive values. */
export function editableConnectionConfiguration(record) {
  if (!connectionConfigurationEditable(record)) {
    throw new Error('Only user-defined or JSON-imported connections can have their configuration edited; use the configure or reauthorize entry for Market connectors');
  }
  const preservedFields = [];
  const item = {
    name: record.name,
    serverName: record.serverName,
    transport: record.transport === 'stdio' ? 'stdio' : 'streamable-http',
  };

  if (record.transport === 'stdio') {
    item.command = safeCommand(record, preservedFields);
    if ((record.args ?? []).length > 0) {
      item.args = [KEEP_EXISTING_VALUE];
      preservedFields.push('connections[0].args');
    } else item.args = [];
    item.env = keepObjectKeys(record.env, 'connections[0].env', preservedFields);
    if (record.cwd) {
      item.cwd = KEEP_EXISTING_VALUE;
      preservedFields.push('connections[0].cwd');
    } else item.cwd = '';
  } else {
    item.url = safeUrl(record, preservedFields);
    if (record.allowInsecurePrivateNetwork === true) item.allowInsecurePrivateNetwork = true;
    item.headers = keepObjectKeys(record.headers, 'connections[0].headers', preservedFields);
    item.authMode = record.auth?.mode ?? 'none';
    if (record.auth?.mode === 'bearer') {
      item.bearerToken = KEEP_EXISTING_VALUE;
      preservedFields.push('connections[0].bearerToken');
    } else if (record.auth?.mode === 'api-key') {
      item.apiKeyHeader = record.auth.apiKeyHeader || 'X-Api-Key';
      item.apiKeyValue = KEEP_EXISTING_VALUE;
      preservedFields.push('connections[0].apiKeyValue');
    }
  }

  return {
    key: record.key,
    serverName: record.serverName,
    normalized: true,
    preservedFields,
    json: JSON.stringify({ connections: [item] }, null, 2),
  };
}

function parseInput(input) {
  if (typeof input !== 'string') return structuredClone(input);
  try {
    return JSON.parse(input);
  } catch (error) {
    throw new Error(`JSON parsing failed: ${error.message}`);
  }
}

function singleConfig(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('The top level of the JSON must be an object');
  }
  if (Array.isArray(document.connections)) {
    if (document.connections.length !== 1) throw new Error('When editing a configuration you can only submit the single current connection');
    return document.connections[0];
  }
  if (document.mcpServers && typeof document.mcpServers === 'object' && !Array.isArray(document.mcpServers)) {
    const entries = Object.entries(document.mcpServers);
    if (entries.length !== 1) throw new Error('When editing a configuration you can only submit the single current mcpServer');
    return entries[0][1];
  }
  throw new Error('Expected { connections: [...] } or { mcpServers: {...} }');
}

function existingHeaderValue(record, key) {
  const direct = Object.entries(record.headers ?? {}).find(([name]) => name.toLowerCase() === key.toLowerCase());
  if (direct) return direct[1];
  if (key.toLowerCase() === 'authorization' && record.auth?.mode === 'bearer') {
    return `Bearer ${record.auth.bearerToken}`;
  }
  if (record.auth?.mode === 'api-key' && record.auth.apiKeyHeader?.toLowerCase() === key.toLowerCase()) {
    return record.auth.apiKeyValue;
  }
  return undefined;
}

function replaceKeepMarkers(document, current) {
  const item = singleConfig(document);
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('The connection configuration must be a JSON object');

  if (item.url === KEEP_EXISTING_VALUE) {
    if (!current.url) throw new Error('There is no original url value to keep, please provide a new value');
    item.url = current.url;
  }
  if (item.command === KEEP_EXISTING_VALUE) {
    if (!current.command) throw new Error('There is no original command value to keep, please provide a new value');
    item.command = current.command;
  }
  if (Array.isArray(item.args) && item.args.length === 1 && item.args[0] === KEEP_EXISTING_VALUE) {
    item.args = [...(current.args ?? [])];
  }
  if (item.cwd === KEEP_EXISTING_VALUE) item.cwd = current.cwd ?? '';

  for (const [key, value] of Object.entries(item.headers ?? {})) {
    if (value !== KEEP_EXISTING_VALUE) continue;
    const existing = existingHeaderValue(current, key);
    if (existing === undefined) throw new Error(`The header ${key} has no original value to keep, please provide a new value`);
    item.headers[key] = existing;
  }
  for (const [key, value] of Object.entries(item.env ?? {})) {
    if (value !== KEEP_EXISTING_VALUE) continue;
    if (current.env?.[key] === undefined) throw new Error(`The environment variable ${key} has no original value to keep, please provide a new value`);
    item.env[key] = current.env[key];
  }
  if (item.bearerToken === KEEP_EXISTING_VALUE) {
    if (current.auth?.mode !== 'bearer' || !current.auth.bearerToken) throw new Error('The Bearer Token has no original value to keep, please provide a new value');
    item.bearerToken = current.auth.bearerToken;
  }
  if (item.apiKeyValue === KEEP_EXISTING_VALUE) {
    if (current.auth?.mode !== 'api-key' || current.auth.apiKeyValue === undefined || current.auth.apiKeyValue === '') {
      throw new Error('The API Key has no original value to keep, please provide a new value');
    }
    item.apiKeyValue = current.auth.apiKeyValue;
  }
}

function findKeepMarkers(value, path = '$', output = []) {
  if (value === KEEP_EXISTING_VALUE) output.push(path);
  else if (Array.isArray(value)) value.forEach((item, index) => findKeepMarkers(item, `${path}[${index}]`, output));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) findKeepMarkers(item, `${path}.${key}`, output);
  }
  return output;
}

/**
 * Merge the editor JSON into a new ConnectionRecord.
 * key / serverName / connectorId / kind / enabled / scope stay locked to the previous record.
 */
export function normalizeConnectionReconfiguration(current, input) {
  if (!connectionConfigurationEditable(current)) {
    throw new Error('Only user-defined or JSON-imported connections can have their configuration edited; use the configure or reauthorize entry for Market connectors');
  }
  const document = parseInput(input);
  replaceKeepMarkers(document, current);
  const unresolved = findKeepMarkers(document);
  if (unresolved.length > 0) throw new Error(`There are unrecognizable keep markers: ${unresolved.slice(0, 3).join(', ')}`);

  const { records, skipped } = normalizeJsonImport(document);
  if (records.length !== 1 || skipped.length > 0) throw new Error('When editing a configuration you must submit, and can only submit, the single current valid connection');
  const parsed = records[0];
  if (parsed.serverName !== current.serverName) {
    throw new Error(`serverName is the connection identity and cannot be changed from "${current.serverName}" to "${parsed.serverName}"; please create a new connection`);
  }
  parsed.name = normalizeConnectionDisplayName(parsed.name);
  if (parsed.auth?.mode === 'bearer' && !parsed.auth.bearerToken) throw new Error('The Bearer Token is required, or use a keep marker');
  if (parsed.auth?.mode === 'api-key' && (parsed.auth.apiKeyValue === undefined || parsed.auth.apiKeyValue === '')) {
    throw new Error('The API Key is required, or use a keep marker');
  }

  const stdio = parsed.transport === 'stdio';
  return {
    ...parsed,
    key: current.key,
    connectorId: current.connectorId,
    kind: current.kind,
    serverKey: current.serverKey,
    enabled: current.enabled !== false,
    createdAt: current.createdAt,
    updatedAt: Date.now(),
    lastError: undefined,
    ...(stdio
      ? { url: undefined, allowInsecurePrivateNetwork: undefined, headers: {}, auth: undefined }
      : { command: undefined, args: undefined, env: undefined, cwd: undefined }),
  };
}
