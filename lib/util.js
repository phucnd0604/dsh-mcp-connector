/**
  * Platform helpers: open the system default browser (macOS/Linux/Windows) + general utilities.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

/**
  * Build the open command per platform (a pure function, so it is easy to unit test).
 */
export function buildOpenCommand(url, platform = process.platform) {
  if (platform === 'darwin') {
    return { command: 'open', args: [url], options: { detached: true, stdio: 'ignore' } };
  }
  if (platform === 'win32') {
    // Critical Windows fix: cmd.exe treats an unquoted `&` as a command separator, which would drop the authorization URL
    // query parameters. The URL must be double-quoted, `start` needs an empty title placeholder, and verbatimArguments must pass the arguments through as-is.
    return {
      command: 'cmd',
      args: ['/c', 'start', '""', `"${url}"`],
      options: { detached: true, stdio: 'ignore', windowsVerbatimArguments: true },
    };
  }
  return { command: 'xdg-open', args: [url], options: { detached: true, stdio: 'ignore' } };
}

export function openBrowser(url, logger) {
  const { command, args, options } = buildOpenCommand(url);
  const child = spawn(command, args, options);
  child.on('error', (error) => {
    logger?.warn(`mcp-connector: failed to open browser via '${command}': ${error.message}`);
  });
  child.unref();
}

/** Stable short hash (used for grant keys and similar) */
export function shortHash(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/** Normalize a serverName: lowercase, spaces to hyphens, illegal characters removed */
export function slugServerName(input) {
  const slug = String(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[^a-z0-9]+/, '')
    .replace(/[^a-z0-9]+$/, '')
    .slice(0, 63);
  // A non-ASCII name such as Chinese can normalize to an empty string: fall back to a stable ASCII name so the connection still works
  if (!slug) return `srv-${shortHash(input)}`;
  return slug;
}

/** Normalize the user-editable connection display name; not used for serverName or tool prefixes. */
export function normalizeConnectionDisplayName(input) {
  const name = String(input ?? '').trim();
  if (!name) throw new Error('The connection display name cannot be empty');
  if (/[\u0000-\u001f\u007f]/.test(name)) throw new Error('The connection display name cannot contain control characters');
  if ([...name].length > 80) throw new Error('The connection display name cannot exceed 80 characters');
  return name;
}

function parseUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`invalid url: ${rawUrl}`);
  }
  return url;
}

function normalizedHostname(hostname) {
  return String(hostname ?? '').trim().toLowerCase().replace(/^\[|\]$/g, '');
}

/** Accepts only literal RFC1918 IPv4 or RFC4193 IPv6 ULA addresses; domains are never resolved, which prevents DNS rebinding. */
export function isPrivateNetworkHost(hostname) {
  const host = normalizedHostname(hostname);
  const version = isIP(host);
  if (version === 4) {
    const octets = host.split('.').map(Number);
    return octets[0] === 10
      || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
      || (octets[0] === 192 && octets[1] === 168);
  }
  if (version === 6) {
    const firstHextet = Number.parseInt(host.split(':', 1)[0], 16);
    return Number.isFinite(firstHextet) && (firstHextet & 0xfe00) === 0xfc00;
  }
  return false;
}

function isLoopbackHost(hostname) {
  return ['127.0.0.1', 'localhost', '::1'].includes(normalizedHostname(hostname));
}

/** URL scheme allowlist: https and loopback http only. Used for the catalog, OAuth, and other public boundaries. */
export function assertSafeUrl(rawUrl) {
  const url = parseUrl(rawUrl);
  if (url.protocol === 'https:') return url;
  if (url.protocol === 'http:' && isLoopbackHost(url.hostname)) return url;
  throw new Error(`url protocol not allowed (only https or loopback http): ${rawUrl}`);
}

/**
  * A narrow exception for user-created MCP connections: private-network HTTP is still denied by default and is allowed only when the user
  * explicitly confirms and the host is a private IP literal. Public HTTP, domains, link-local and metadata addresses stay denied.
 */
export function assertConnectionUrl(rawUrl, { allowInsecurePrivateNetwork = false } = {}) {
  const url = parseUrl(rawUrl);
  if (url.protocol === 'https:' || (url.protocol === 'http:' && isLoopbackHost(url.hostname))) return url;
  if (url.protocol === 'http:' && isPrivateNetworkHost(url.hostname)) {
    if (allowInsecurePrivateNetwork === true) return url;
    const error = new Error(`insecure private-network HTTP requires explicit confirmation: ${rawUrl}`);
    error.code = 'INSECURE_PRIVATE_NETWORK_REQUIRES_CONFIRMATION';
    throw error;
  }
  throw new Error(`url protocol not allowed (only https, loopback http, or explicitly approved private-network http): ${rawUrl}`);
}

/** Header name allowlist */
export function assertSafeHeaderName(name) {
  if (!/^[A-Za-z0-9_-]+$/.test(String(name))) {
    throw new Error(`invalid header name: ${name}`);
  }
  return String(name);
}
