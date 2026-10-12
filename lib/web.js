/**
 * MCP Connector — web half: provides the HTTP routes for the graphical "plugin marketplace".
 *
 * Same-origin prefixes mounted on ctx.webServer:
 *   - GET  /mcp-connector/ui/*   static SPA (single-page marketplace: market / installed / install / uninstall)
 *   - POST /mcp-connector/api    JSON-RPC style dispatch (method allowlist → api facade)
 *   - GET  /mcp-connector/events live status SSE with no sensitive data
 *
 * Every route passes the browser trust fence (loopback + same origin), following the same policy as better-sidebar.
 * This module depends only on ctx.webServer / ctx.webRuntime; in a non-web deployment (without those
 * two services) the caller should skip mounting so the plugin stays usable in chat-tool-only scenarios.
 */
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const UI_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'ui');

/** Methods GET /mcp-connector/api may dispatch → api facade (allowlist, so arbitrary reflective calls are impossible). */
const API_WHITELIST = new Map([
  ['versionStatus', (api, p) => api.versionStatus(p?.force === true)],
  ['governance', (api) => api.governance()],
  ['previewPolicy', (api, p) => api.previewPolicy(p ?? {})],
  ['applyPolicy', (api, p) => api.applyPolicy(p ?? {})],
  ['rollbackPolicy', (api, p) => api.rollbackPolicy(p?.rollbackRevision, p?.expectedRevision)],
  ['scopeContext', (api, p) => api.scopeContext(p?.workspaceId)],
  ['previewConnectionScope', (api, p) => api.previewConnectionScope(p ?? {})],
  ['applyConnectionScope', (api, p) => api.applyConnectionScope(p ?? {})],
  ['previewConnectionScopeRollback', (api, p) => api.previewConnectionScopeRollback(p?.rollbackRevision)],
  ['rollbackConnectionScope', (api, p) => api.rollbackConnectionScope(p?.rollbackRevision, p?.expectedRevision)],
  ['catalog', (api, p) => api.catalog(p ?? {})],
  ['status', (api, p) => api.status(p ?? {})],
  ['healthCheck', (api, p) => api.healthCheck(p?.connectorId)],
  ['migrationPreview', (api, p) => api.migrationPreview(p ?? {})],
  ['migrateLegacy', (api, p) => api.migrateLegacy(p?.candidateIds ?? [])],
  ['connect', (api, p) => api.connect(p?.connectorId, p?.serverKey, undefined, p ?? {})],
  ['configure', (api, p) => api.configure(p ?? {})],
  ['importJson', (api, p) => api.importJson(p?.json, p ?? {})],
  ['exportConfig', (api) => api.exportConfig()],
  ['listSnapshots', (api) => api.listSnapshots()],
  ['createSnapshot', (api, p) => api.createSnapshot(p?.label)],
  ['previewSnapshot', (api, p) => api.previewSnapshot(p?.snapshotId)],
  ['restoreSnapshot', (api, p) => api.restoreSnapshot(p?.snapshotId)],
  ['installFromUrl', (api, p) => api.installFromUrl(p?.url, p ?? {})],
  ['renameConnection', (api, p) => api.renameConnection(p?.key, p?.name)],
  ['editableConnectionConfig', (api, p) => api.editableConnectionConfig(p?.key)],
  ['reconfigureConnection', (api, p) => api.reconfigureConnection(p?.key, p?.json)],
  ['disconnect', (api, p) => api.disconnect(p?.key)],
  ['setEnabled', (api, p) => api.setEnabled(p?.key, p?.enabled !== false)],
  ['setInjectionMode', (api, p) => api.setInjectionMode(p?.key, p?.mode)],
  ['refreshCatalog', (api) => api.refreshCatalog()],
  ['toolsList', (api, p) => api.toolsList(p?.connectorId, p?.workspaceId, p?.cachedOnly === true, p?.connectionKey)],
  ['toolSearch', (api, p) => api.toolSearch(p ?? {})],
  ['toolExplorer', (api, p) => api.toolExplorer(p ?? {})],
  ['toolExplorerDetail', (api, p) => api.toolExplorerDetail(p ?? {})],
  ['toolExplorerAction', (api, p) => api.toolExplorerAction(p ?? {})],
  ['toolDetail', (api, p) => api.toolDetail(p ?? {})],
]);

/* ───────────────────────── Trust fence ───────────────────────── */

function header(headers, name) {
  const value = headers?.[name];
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseAuthority(host) {
  if (typeof host !== 'string' || host.length === 0) return undefined;
  try {
    const u = new URL(`http://${host}`);
    if (!u.hostname) return undefined;
    return { hostname: u.hostname, host: u.host, port: u.port };
  } catch {
    return undefined;
  }
}

function isLoopbackHostname(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0:0:0:0:0:0:0:1' ||
    hostname.endsWith('.localhost')
  );
}

function isTrustedAuthority(url, trustedHosts) {
  for (const raw of trustedHosts ?? []) {
    const authority = typeof raw === 'string' ? parseAuthority(raw) : undefined;
    if (authority && authority.host === url.host) return true;
  }
  return false;
}

/**
 * Browser trust fence: the Host must be the local loopback address or a trusted domain declared by the deployment, and the request must not be cross-site, with Origin matching Host.
 */
export function isTrustedWebRequest(request, trustedHosts = []) {
  const host = header(request.headers, 'host');
  if (host === undefined) return false;
  const hostUrl = parseAuthority(host);
  if (hostUrl === undefined) return false;
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false;
  if (header(request.headers, 'sec-fetch-site') === 'cross-site') return false;
  const origin = header(request.headers, 'origin');
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}

/* ───────────────────────── Small helpers ───────────────────────── */

function writeJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

async function readJsonBody(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 1024 * 1024) throw new Error('The request body must not exceed 1 MiB');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text.trim()) return {};
  return JSON.parse(text);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function extOf(pathname) {
  const i = pathname.lastIndexOf('.');
  return i >= 0 ? pathname.slice(i).toLowerCase() : '';
}

/** Safely maps a URL pathname to a file inside the ui directory (blocks directory traversal). */
export function splitUiPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  const segments = decoded.replace(/\\/g, '/').split('/').filter((segment) => segment !== '' && segment !== '.');
  if (segments.includes('..')) return undefined;
  return segments;
}

export function resolveUiFile(pathname) {
  const segments = splitUiPath(pathname);
  if (segments === undefined) return { ok: false };
  if (segments.length === 0) return { ok: true, path: join(UI_DIR, 'index.html'), rel: 'index.html' };
  const abs = resolve(UI_DIR, ...segments);
  const relAbs = relative(UI_DIR, abs);
  if (relAbs === '..' || relAbs.startsWith(`..${sep}`) || isAbsolute(relAbs) || relAbs === '') return { ok: false };
  return { ok: true, path: abs, rel: segments.join('/') };
}

/* ───────────────────────── Route mounting ───────────────────────── */

/**
 * Mounts the web routes. `wctx` is the sub-context that already has webServer/webRuntime injected.
 * Returns a disposer (unmounts the three prefix routes).
 */
export function mountWebRoutes(wctx, api, { logger, eventHub } = {}) {
  const trustedHosts = wctx.webRuntime?.trustedHosts ?? [];
  const fence = (req) => isTrustedWebRequest(req, trustedHosts);

  const apiDisposer = wctx.webServer.register({
    kind: 'prefix',
    path: '/mcp-connector/api',
    handler: async (req, res) => {
      if (!fence(req)) {
        writeJson(res, 403, { ok: false, message: 'forbidden' });
        return;
      }
      if (req.method !== 'POST') {
        res.writeHead(405, { allow: 'POST' });
        res.end();
        return;
      }
      try {
        const body = await readJsonBody(req);
        const dispatch = API_WHITELIST.get(body?.method);
        if (!dispatch) {
          writeJson(res, 400, { ok: false, message: `Unknown method "${body?.method ?? ''}" (available: ${[...API_WHITELIST.keys()].join(', ')})` });
          return;
        }
        const result = await dispatch(api, body?.params ?? {});
        writeJson(res, 200, { ok: true, ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger?.warn?.(`web api error: ${message}`);
        writeJson(res, 400, { ok: false, message });
      }
    },
  });

  const eventsDisposer = wctx.webServer.register({
    kind: 'prefix',
    path: '/mcp-connector/events',
    handler: async (req, res) => {
      if (!fence(req)) {
        writeJson(res, 403, { ok: false, message: 'forbidden' });
        return;
      }
      if (req.method !== 'GET') {
        res.writeHead(405, { allow: 'GET' });
        res.end();
        return;
      }
      if (!eventHub) {
        writeJson(res, 503, { ok: false, message: 'status events unavailable' });
        return;
      }
      if (!eventHub.subscribe(req, res)) {
        writeJson(res, 503, { ok: false, message: 'too many status event clients' });
      }
    },
  });

  const uiDisposer = wctx.webServer.register({
    kind: 'prefix',
    path: '/mcp-connector/ui',
    handler: async (req, res) => {
      if (!fence(req)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { allow: 'GET, HEAD' });
        res.end();
        return;
      }
      const pathname = new URL(req.url ?? '/', 'http://localhost').pathname.replace(/^\/mcp-connector\/ui/, '') || '/';
      const file = resolveUiFile(pathname);
      if (!file.ok) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      try {
        const body = await readFile(file.path);
        res.writeHead(200, {
          'content-type': MIME[extOf(file.rel)] ?? 'application/octet-stream',
          'cache-control': 'no-cache',
          'x-content-type-options': 'nosniff',
          'referrer-policy': 'no-referrer',
          'content-security-policy': "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
          'content-length': body.length,
        });
        res.end(req.method === 'HEAD' ? undefined : body);
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
    },
  });

  return () => {
    apiDisposer?.();
    eventsDisposer?.();
    uiDisposer?.();
  };
}
