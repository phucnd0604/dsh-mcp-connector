/**
 * Connector catalog: built-in + remote registry + config injection + local publish/unpublish overrides.
 * The merge key is id; priority: local overrides > config.connectors > remote registry > built-in catalog.
 */
import { readFileSync } from 'node:fs';
import { normalizeConnectorDescriptor } from './schema.js';
import { assertSafeUrl, assertSafeHeaderName } from './util.js';

const MAX_CATALOG_BYTES = 2 * 1024 * 1024;

const SECRET_KEY_RE = /^(?:access[-_]?token|refresh[-_]?token|token|api[-_]?key|secret|client[-_]?secret|password|authorization)$/i;
const SECRET_ENV_RE = /(?:token|secret|api[_-]?key|password|authorization|credential)/i;

/** Scan the raw JSON before zod drops unknown fields, so that smuggled tokens are not silently ignored. */
export function auditRawDescriptor(raw, path = 'connector') {
  if (!raw || typeof raw !== 'object') return raw;
  for (const [key, value] of Object.entries(raw)) {
    const fieldPath = `${path}.${key}`;
    // In credentialBindings the key is the environment variable name to inject and the value may
    // only be a credential field reference; the real value is written to the ConnectionRecord after the local form is submitted and must never appear in the catalog.
    if (key === 'credentialBindings') continue;
    // credentialFields[].secret is only a boolean declaration meaning "render as a password field", not a secret value.
    if (key === 'secret' && typeof value === 'boolean' && /\.auth\.credentialFields\.\d+\.secret$/.test(fieldPath)) continue;
    if (SECRET_KEY_RE.test(key) && value !== undefined && value !== null && String(value).trim() !== '') {
      throw new Error(`${fieldPath} must not carry credentials or secrets`);
    }
    if (typeof value === 'object') auditRawDescriptor(value, fieldPath);
  }
  return raw;
}

/** Reads the bundled built-in catalog */
export function loadBundledCatalog() {
  try {
    const raw = readFileSync(new URL('../catalog/catalog.json', import.meta.url), 'utf8');
    const data = JSON.parse(raw);
    const list = Array.isArray(data) ? data : Array.isArray(data?.connectors) ? data.connectors : [];
    return list.map(normalizeConnectorDescriptor);
  } catch {
    return [];
  }
}

/** Security audit: the catalog must not carry secrets, and URL protocols and header names are allowlisted. */
export function auditDescriptor(descriptor) {
  const oauthHttpResources = new Set(
    descriptor.servers
      .filter((server) => server.transport === 'streamable-http')
      .map((server) => server.url),
  );
  const credentialFields = descriptor.auth.credentialFields ?? [];
  const credentialKeys = new Set();
  for (const field of credentialFields) {
    if (credentialKeys.has(field.key)) throw new Error(`connector "${descriptor.id}" has a duplicate auth.credentialFields key: ${field.key}`);
    credentialKeys.add(field.key);
  }
  const referencedCredentials = new Set();
  for (const server of descriptor.servers) {
    if (server.transport === 'stdio') {
      for (const name of Object.keys(server.env ?? {})) {
        if (SECRET_ENV_RE.test(name)) {
          throw new Error(`connector "${descriptor.id}" servers[].env must not carry secret-like variables: ${name}`);
        }
      }
      const bindings = server.credentialBindings ?? {};
      if (descriptor.auth.mode === 'oauth2-pkce') {
        if (Object.keys(bindings).length > 0) {
          throw new Error(`an OAuth stdio server in connector "${descriptor.id}" must not declare credentialBindings at the same time`);
        }
        if (!server.oauthResource || !server.oauthTokenEnv) {
          throw new Error(`an OAuth stdio server in connector "${descriptor.id}" must declare oauthResource and oauthTokenEnv`);
        }
        assertSafeUrl(server.oauthResource);
        if (!oauthHttpResources.has(server.oauthResource)) {
          throw new Error(`the OAuth stdio oauthResource in connector "${descriptor.id}" must reference an HTTP resource of the same connector`);
        }
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(server.oauthTokenEnv)) {
          throw new Error(`connector "${descriptor.id}" has an invalid oauthTokenEnv variable name: ${server.oauthTokenEnv}`);
        }
        if (Object.hasOwn(server.env ?? {}, server.oauthTokenEnv)) {
          throw new Error(`connector "${descriptor.id}" declares oauthTokenEnv twice with servers[].env: ${server.oauthTokenEnv}`);
        }
        continue;
      }
      if (server.oauthResource || server.oauthTokenEnv) {
        throw new Error(`only OAuth stdio servers in connector "${descriptor.id}" may declare oauthResource/oauthTokenEnv`);
      }
      if (descriptor.auth.mode === 'none' && Object.keys(bindings).length > 0) {
        throw new Error(`the stdio credentialBindings in connector "${descriptor.id}" require a bearer/api-key credential definition`);
      }
      if (['bearer', 'api-key'].includes(descriptor.auth.mode) && Object.keys(bindings).length === 0) {
        throw new Error(`credential-type stdio servers in connector "${descriptor.id}" must declare credentialBindings`);
      }
      for (const [envName, credentialKey] of Object.entries(bindings)) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(envName)) {
          throw new Error(`connector "${descriptor.id}" has an invalid credentialBindings variable name: ${envName}`);
        }
        if (Object.hasOwn(server.env ?? {}, envName)) {
          throw new Error(`connector "${descriptor.id}" declares credentialBindings twice with servers[].env: ${envName}`);
        }
        if (!credentialKeys.has(credentialKey)) {
          throw new Error(`connector "${descriptor.id}" credentialBindings references an unknown credential field: ${credentialKey}`);
        }
        referencedCredentials.add(credentialKey);
      }
      continue;
    }
    assertSafeUrl(server.url);
    for (const name of Object.keys(server.headers ?? {})) {
      assertSafeHeaderName(name);
      if (/authorization|token|secret|api[-_]?key/i.test(name)) {
        throw new Error(`connector "${descriptor.id}" servers[].headers must not carry secret-like headers: ${name}`);
      }
    }
  }
  if (descriptor.auth.mode === 'oauth2-pkce' && oauthHttpResources.size === 0) {
    throw new Error(`the OAuth authorization in connector "${descriptor.id}" needs at least one HTTP resource`);
  }
  if (['bearer', 'api-key'].includes(descriptor.auth.mode)) {
    const httpServers = descriptor.servers.filter((server) => server.transport === 'streamable-http');
    if (httpServers.length > 0 && credentialFields[0]) referencedCredentials.add(credentialFields[0].key);
    for (const field of credentialFields) {
      if (field.required && !referencedCredentials.has(field.key)) {
        throw new Error(`the required credential field in connector "${descriptor.id}" is unused by HTTP or stdio: ${field.key}`);
      }
    }
  }
  return descriptor;
}

export async function readLimitedJson(response, maxBytes = MAX_CATALOG_BYTES) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error(`The JSON response exceeds ${maxBytes} bytes`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error(`The JSON response exceeds ${maxBytes} bytes`);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw new Error(`JSON parsing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Fetches the remote registry (HTTPS + TTL cache + optional ETag) */
export async function fetchRemoteCatalog(catalogUrl, { requestTimeoutMs, etag } = {}) {
  assertSafeUrl(catalogUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), requestTimeoutMs ?? 15_000);
  try {
    const headers = {};
    if (etag) headers['If-None-Match'] = etag;
    const response = await fetch(catalogUrl, { headers, signal: controller.signal });
    assertSafeUrl(response.url || catalogUrl);
    if (response.status === 304) return { notModified: true };
    if (!response.ok) throw new Error(`catalog fetch HTTP ${response.status}`);
    const data = await readLimitedJson(response);
    const list = Array.isArray(data) ? data : Array.isArray(data?.connectors) ? data.connectors : [];
    const connectors = list.map((raw) => auditDescriptor(normalizeConnectorDescriptor(auditRawDescriptor(raw))));
    return { notModified: false, etag: response.headers.get('etag') ?? undefined, connectors };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches the remote registry sources in order. Only the primary source uses the cached ETag;
 * fallback sources are always fetched in full, and their ETag is never returned so that the next request cannot send it to the primary source by mistake.
 */
export async function fetchRemoteCatalogWithFallback(catalogUrl, fallbackUrls = [], opts = {}) {
  const urls = [catalogUrl, ...fallbackUrls].filter(Boolean);
  let lastError;
  for (let index = 0; index < urls.length; index += 1) {
    try {
      const fetched = await fetchRemoteCatalog(urls[index], {
        requestTimeoutMs: opts.requestTimeoutMs,
        etag: index === 0 ? opts.etag : undefined,
      });
      return index === 0 ? fetched : { ...fetched, etag: undefined };
    } catch (error) {
      lastError = error;
      opts.onSourceError?.({ index, error });
    }
  }
  throw lastError ?? new Error('catalog fetch failed for all sources');
}

/** An unpublished local draft must not hide the published remote card with the same id; other dynamic cards can still override. */
export function visibleDynamicDescriptors(remote, dynamic) {
  const publishedRemoteIds = new Set(remote.filter((d) => d.published !== false).map((d) => d.id));
  return dynamic.filter((d) => d.published !== false || !publishedRemoteIds.has(d.id));
}

/** Merges multiple source layers (sources is an array of descriptor arrays ordered from lowest to highest priority), then applies the local overrides. */
export function mergeCatalog(sources, overrides = new Map()) {
  const merged = new Map();
  for (const list of sources) {
    for (const descriptor of list) {
      merged.set(descriptor.id, descriptor);
    }
  }
  for (const [id, patch] of overrides) {
    const current = merged.get(id);
    if (!current) continue;
    const next = { ...current };
    if (typeof patch.published === 'boolean') next.published = patch.published;
    if (typeof patch.featured === 'boolean') next.featured = patch.featured;
    merged.set(id, next);
  }
  return [...merged.values()];
}

/** Catalog query (publishedOnly shows only published entries by default) */
export function listCatalog(merged, { category, keyword, publishedOnly = true } = {}) {
  let list = merged;
  if (publishedOnly) list = list.filter((d) => d.published !== false);
  if (category) list = list.filter((d) => d.category === category);
  if (keyword) {
    const kw = String(keyword).toLowerCase();
    list = list.filter((d) =>
      [d.id, d.name, d.vendor, d.category, d.summary, d.description, ...(d.tags ?? [])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(kw)),
    );
  }
  // Featured entries come first; within the same tier the declared catalog order is preserved, so the marketplace display order stays deliberate.
  return [...list].sort((a, b) => (b.featured === true) - (a.featured === true));
}
