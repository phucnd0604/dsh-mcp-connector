/**
 * Dynamic configuration of MCP entries: creates / updates / disables / removes @deepseek-ai/dsh-mcp-client entries through ctx.loader.
 * entryId = {entryPrefix}-{record.key}; serverName determines the tool name prefix and never changes during the lifetime → idempotent.
 */

import { cliBridgeArgs } from './cli-providers.js';
import { fileURLToPath } from 'node:url';

const STDIO_STARTUP_GUARD = fileURLToPath(new URL('./stdio-startup-guard.js', import.meta.url));

export function entryIdFor(config, record) {
  return `${config.entryPrefix}-${record.key}`;
}

/** Build the entry headers (including auth headers) from a connection record + grant set */
export function authHeaders(record, grants) {
  const headers = { ...(record.headers ?? {}) };
  if (!record.auth) return headers;
  if (record.auth.mode === 'oauth') {
    const grant = record.auth.grantKey ? grants.get(record.auth.grantKey) : null;
    if (grant?.accessToken) headers.Authorization = `Bearer ${grant.accessToken}`;
  } else if (record.auth.mode === 'bearer') {
    if (record.auth.bearerToken) headers.Authorization = `Bearer ${record.auth.bearerToken}`;
  } else if (record.auth.mode === 'api-key') {
    if (record.auth.apiKeyHeader && record.auth.apiKeyValue !== undefined && record.auth.apiKeyValue !== '') {
      headers[record.auth.apiKeyHeader] = record.auth.apiKeyValue;
    }
  }
  return headers;
}

export function buildEntryConfig(record, grants, { failOnStartupError = false, startupRequestTimeoutMs } = {}) {
  if (record.transport === 'stdio') {
    const env = { ...(record.env ?? {}) };
    if (record.auth?.mode === 'oauth' && record.oauthTokenEnv) {
      const grant = record.auth.grantKey ? grants.get(record.auth.grantKey) : null;
      if (grant?.accessToken) env[record.oauthTokenEnv] = `Bearer ${grant.accessToken}`;
    }
    const guarded = startupRequestTimeoutMs !== undefined;
    if (guarded && (!Number.isSafeInteger(startupRequestTimeoutMs) || startupRequestTimeoutMs < 100 || startupRequestTimeoutMs > 2_147_483_647)) {
      throw new RangeError('stdio startup request timeout must be an integer between 100 and 2147483647 ms');
    }
    const args = cliBridgeArgs(record);
    return {
      transport: 'stdio',
      serverName: record.serverName,
      command: guarded ? process.execPath : record.command,
      args: guarded ? [STDIO_STARTUP_GUARD, '--timeout-ms', String(startupRequestTimeoutMs), '--', record.command, ...args] : args,
      env,
      cwd: record.cwd || process.cwd(),
      failOnStartupError,
    };
  }
  return {
    transport: 'streamable-http',
    serverName: record.serverName,
    url: record.url,
    headers: authHeaders(record, grants),
    failOnStartupError,
  };
}

function hasEntry(ctx, id) {
  try {
    ctx.loader.resolve(id);
    return true;
  } catch {
    return false;
  }
}

/** Create or update one mcp-client entry (idempotent; tool names stay the same while serverName is unchanged) */
export async function provision(ctx, config, record, grants, { failOnStartupError = false, startupRequestTimeoutMs } = {}) {
  const id = entryIdFor(config, record);
  const entryConfig = buildEntryConfig(record, grants, { failOnStartupError, startupRequestTimeoutMs });
  const disabled = record.enabled === false;
  if (hasEntry(ctx, id)) {
    const existing = ctx.loader.resolve(id);
    const previous = existing?.options?.config ?? {};
    const nextConfig = previous.transport && previous.transport !== entryConfig.transport
      ? entryConfig
      : { ...previous, ...entryConfig };
    await ctx.loader.update(id, { config: nextConfig, disabled });
  } else {
    await ctx.loader.create({ id, name: '@deepseek-ai/dsh-mcp-client', config: entryConfig, disabled });
  }
  return id;
}

/** Disable (the record is kept and can be re-enabled) */
export async function disable(ctx, config, record) {
  const id = entryIdFor(config, record);
  if (hasEntry(ctx, id)) await ctx.loader.update(id, { disabled: true });
  return id;
}

/** Remove the entry */
export async function remove(ctx, config, record) {
  const id = entryIdFor(config, record);
  if (hasEntry(ctx, id)) await ctx.loader.remove(id);
  return id;
}

/** Deduplicate by serverName (used for idempotent upsert) */
export function dedupeByServerName(records) {
  const seen = new Map();
  for (const record of records) {
    if (seen.has(record.serverName)) continue;
    seen.set(record.serverName, record);
  }
  return [...seen.values()];
}
