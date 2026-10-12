/**
 * MCP connector plugin - constant definitions
 */
export const PLUGIN_NAME = 'mcp-connector';

/** Default scope for generic OAuth */
export const DEFAULT_SCOPE = 'mcp:tools';

/** Default account identifier (reserved for multi-account support) */
export const DEFAULT_ACCOUNT = 'default';

/** connectorId placeholders for user-defined / JSON-imported connections */
export const CUSTOM_CONNECTOR_ID = '__custom__';
export const JSON_CONNECTOR_ID = '__json__';

/** Reserved id prefixes: the community PR registry refuses to accept them */
export const RESERVED_ID_PREFIXES = ['qcc-', 'dsh-', 'mcp-connector-'];

/** Primary remote registry catalog source (jsDelivr CDN, more stable on domestic networks) */
export const DEFAULT_CATALOG_URL =
  'https://cdn.jsdelivr.net/gh/duhu2000/dsh-mcp-connector-registry@main/catalog.json';

/** Tried in order when the default catalog source fails; only for configurations without a custom catalogUrl. */
export const DEFAULT_CATALOG_FALLBACK_URLS = [
  'https://raw.githubusercontent.com/duhu2000/dsh-mcp-connector-registry/main/catalog.json',
];

/** Request / refresh defaults */
export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
/** Longest wait for the first MCP Server startup to complete initialize + tools/list */
export const DEFAULT_STARTUP_TIMEOUT_MS = 120_000;
export const DEFAULT_REFRESH_SKEW_MS = 300_000;
/** Exponential backoff range after a transient OAuth refresh failure. */
export const DEFAULT_REFRESH_RETRY_BASE_MS = 30_000;
export const DEFAULT_REFRESH_RETRY_MAX_MS = 300_000;
export const DEFAULT_CATALOG_TTL_MS = 3_600_000;

/** PKCE constraints (RFC 7636) */
export const VERIFIER_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._~-';
export const VERIFIER_MIN_LENGTH = 43;
export const VERIFIER_MAX_LENGTH = 128;

/** Protocol version used for MCP Streamable HTTP probing */
export const MCP_PROTOCOL_VERSION = '2025-03-26';
