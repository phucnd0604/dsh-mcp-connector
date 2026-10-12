/**
  * zod validation: ConnectorDescriptor / ConnectionRecord / GrantRecord / JSON import normalization.
  * Uses zod v4; field defaults are filled in during the normalize stage, and the schema only checks shape (lenient validation, explicit errors).
 */
import { z } from 'zod';
import { assertConnectionUrl, isPrivateNetworkHost } from './util.js';

/** Description of a single MCP server in the connector catalog */
export const serverRefSchema = z.object({
  serverKey: z.string().min(1),
  url: z.string().min(1).optional(),
  command: z.string().min(1).optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  credentialBindings: z.record(z.string(), z.string()).optional(),
  oauthResource: z.string().min(1).optional(),
  oauthTokenEnv: z.string().min(1).optional(),
  cwd: z.string().optional(),
  serverName: z.string().min(1),
  transport: z.enum(['streamable-http', 'sse', 'stdio']).optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

/** Marketplace credential input definition; describes the form only and never holds real values. */
export const credentialFieldSchema = z.object({
    key: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]*$/, 'must start with a letter, then only letters, digits, _ or - are allowed'),
  label: z.string().min(1),
  placeholder: z.string().optional(),
  description: z.string().optional(),
  helpLabel: z.string().optional(),
  required: z.boolean().optional(),
  secret: z.boolean().optional(),
});

/** Prompt template variable; the catalog only describes the form and never stores user input. */
export const promptVariableSchema = z.object({
    name: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]*$/, 'must start with a letter, then only letters, digits, _ or - are allowed'),
  label: z.string().min(1),
  placeholder: z.string().optional(),
  description: z.string().optional(),
  required: z.boolean().optional(),
  default: z.string().optional(),
});

/** A single prompt sample */
export const promptSampleSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  server: z.string().optional(),
  variables: z.array(promptVariableSchema).optional(),
});

export const toolSnapshotSchema = z.object({
  serverKey: z.string().min(1),
  serverName: z.string().optional(),
  tools: z.array(z.object({
    name: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional(),
  })),
});

/** Connector descriptor (a catalog listing) */
export const connectorDescriptorSchema = z.object({
  schemaVersion: z.number().int().optional(),
  id: z.string().min(1),
  name: z.string().min(1),
  vendor: z.string().optional(),
  icon: z.string().optional(),
  category: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  published: z.boolean().optional(),
  featured: z.boolean().optional(),
  homepage: z.string().optional(),
  promptVariables: z.array(promptVariableSchema).optional(),
  prompts: z.array(promptSampleSchema).optional(),
  probeStatus: z.enum(['pass', 'partial', 'fail', 'unverified']).optional(),
  probeCheckedAt: z.number().int().optional(),
  probeReportUrl: z.string().optional(),
  toolsSnapshot: z.array(toolSnapshotSchema).optional(),
  auth: z
    .object({
      mode: z.enum(['oauth2-pkce', 'bearer', 'api-key', 'none']),
      issuer: z.string().optional(),
      scope: z.string().optional(),
      clientName: z.string().optional(),
      tokenEndpointAuthMethod: z.enum(['none', 'client_secret_post', 'client_secret_basic']).optional(),
      apiKeyHeader: z.string().optional(),
      grantSharing: z.string().optional(),
      credentialName: z.string().optional(),
      credentialPlaceholder: z.string().optional(),
      credentialDescription: z.string().optional(),
      credentialHelpLabel: z.string().optional(),
      credentialFields: z.array(credentialFieldSchema).optional(),
    })
    .optional(),
  servers: z.array(serverRefSchema).min(1),
});

/** A connection instance on the local machine */
export const connectionRecordSchema = z.object({
  key: z.string().min(1),
  connectorId: z.string().min(1),
  kind: z.enum(['oauth', 'manual', 'json']),
  name: z.string().min(1),
  serverKey: z.string().min(1).optional(),
  transport: z.enum(['streamable-http', 'sse', 'stdio']),
  url: z.string().min(1).optional(),
  allowInsecurePrivateNetwork: z.boolean().optional(),
  command: z.string().min(1).optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  oauthTokenEnv: z.string().min(1).optional(),
  cwd: z.string().optional(),
  serverName: z.string().min(1),
  headers: z.record(z.string(), z.string()).optional(),
  auth: z
    .object({
      mode: z.enum(['oauth', 'bearer', 'api-key']),
      bearerToken: z.string().optional(),
      apiKeyHeader: z.string().optional(),
      apiKeyValue: z.string().optional(),
      grantKey: z.string().optional(),
    })
    .optional(),
  enabled: z.boolean().optional(),
    /** always=keeps the legacy behavior; session=requires the current Agent to explicitly activate exact tool names */
  injectionMode: z.enum(['always', 'session']).optional(),
  lastError: z.string().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

/** Local configuration snapshot taken before a connection change; the full record is only kept in storage-domain and is never returned. */
export const connectionSnapshotSchema = z.object({
  key: z.string().min(1),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  reason: z.string().min(1),
  targetKeys: z.array(z.string().min(1)),
  records: z.array(connectionRecordSchema),
  absentKeys: z.array(z.string().min(1)),
});

export const governanceRuleSchema = z.object({
  id: z.string().min(1),
  scope: z.enum(['connection', 'server', 'tool']),
  effect: z.enum(['allow', 'deny']),
  connectorId: z.string().min(1),
  serverName: z.string().min(1).optional(),
  toolName: z.string().min(1).optional(),
  publicName: z.string().min(1).optional(),
});

const governanceRevisionSchema = z.object({
  revision: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  rules: z.array(governanceRuleSchema),
});

/** Local MCP capability governance policy; holds no connection credentials. */
export const governancePolicySchema = z.object({
  key: z.literal('active'),
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  rules: z.array(governanceRuleSchema),
  history: z.array(governanceRevisionSchema),
});

export const connectionScopeBindingSchema = z.object({
  connectionKey: z.string().min(1),
  global: z.boolean(),
  projects: z.array(z.string().min(1)),
});

const connectionScopeRevisionSchema = z.object({
  revision: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  bindings: z.array(connectionScopeBindingSchema),
});

/** Stores only the connection key and Workspace id, with no connection configuration or credentials. */
export const connectionScopeDocumentSchema = z.object({
  key: z.literal('active'),
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  bindings: z.array(connectionScopeBindingSchema),
  history: z.array(connectionScopeRevisionSchema),
});

/**
   * Safe capability snapshot from the most recent successful tools/list.
   * Only tool metadata and trimmed input schemas are allowed here; call arguments, call results, credentials and raw errors are never stored.
 */
export const toolCatalogRecordSchema = z.object({
  key: z.string().min(1).max(512),
  connectorId: z.string().min(1).max(256),
  serverKey: z.string().min(1).max(256).optional(),
  serverName: z.string().min(1).max(256),
  connectionSignature: z.string().regex(/^[a-f0-9]{64}$/),
  observedAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  truncated: z.boolean().optional(),
  tools: z.array(z.object({
    name: z.string().min(1).max(512),
    title: z.string().max(1024).optional(),
    description: z.string().max(4096).optional(),
    inputSchema: z.unknown().optional(),
    schemaTruncated: z.boolean().optional(),
  })).max(512),
});

/** OAuth grant record (generic, multi-vendor) */
export const grantRecordSchema = z.object({
  key: z.string().min(1),
  issuer: z.string().min(1),
  clientId: z.string().min(1),
  clientSecret: z.string().optional(),
  clientSecretExpiresAt: z.number().optional(),
  tokenEndpointAuthMethod: z.enum(['none', 'client_secret_post', 'client_secret_basic']).optional(),
  clientName: z.string().optional(),
  scope: z.string(),
  account: z.string(),
  accessToken: z.string(),
  accessTokenExpiresAt: z.number(),
  refreshToken: z.string(),
  authorizedResources: z.array(z.string()),
  connectorIds: z.array(z.string()),
  updatedAt: z.number(),
});

/** Catalog cache / override record (storage-domain catalog table) */
export const catalogRecordSchema = z.object({
  key: z.string(), // 'remote' | 'overrides'
  updatedAt: z.number(),
  etag: z.string().optional(),
  connectors: z.array(z.unknown()),
});

/** Parse and normalize a ConnectorDescriptor; fill in defaults for missing fields */
export function normalizeConnectorDescriptor(raw) {
  const parsed = connectorDescriptorSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`invalid connector descriptor: ${issues}`);
  }
  const c = parsed.data;
  const servers = c.servers.map((s) => {
    const rawTransport = s.transport ?? 'streamable-http';
    const transport = rawTransport === 'sse' ? 'streamable-http' : rawTransport;
    if (transport === 'stdio' && !s.command) {
            throw new Error(`server "${s.serverKey}": command is required when transport=stdio`);
    }
    if (transport === 'streamable-http' && !s.url) {
            throw new Error(`server "${s.serverKey}": url is required when transport=streamable-http`);
    }
    return {
      serverKey: s.serverKey,
      url: transport === 'streamable-http' ? s.url : undefined,
      command: transport === 'stdio' ? s.command : undefined,
      args: transport === 'stdio' ? (s.args ?? []) : undefined,
      env: transport === 'stdio' ? (s.env ?? {}) : undefined,
      credentialBindings: transport === 'stdio' ? (s.credentialBindings ?? {}) : undefined,
      oauthResource: transport === 'stdio' ? s.oauthResource : undefined,
      oauthTokenEnv: transport === 'stdio' ? s.oauthTokenEnv : undefined,
      cwd: transport === 'stdio' ? (s.cwd ?? '') : undefined,
      serverName: s.serverName,
      transport,
      headers: transport === 'streamable-http' ? (s.headers ?? {}) : {},
    };
  });
  const authMode = c.auth?.mode ?? 'none';
  const fallbackCredentialLabel = c.auth?.credentialName
        || (authMode === 'bearer' ? 'Bearer Token' : authMode === 'api-key' ? 'API Key' : 'Credential');
  const credentialFields = c.auth?.credentialFields?.length
    ? c.auth.credentialFields.map((field) => ({
        key: field.key,
        label: field.label,
        placeholder: field.placeholder ?? '',
        description: field.description ?? '',
        helpLabel: field.helpLabel ?? '',
        required: field.required !== false,
        secret: field.secret !== false,
      }))
    : ['bearer', 'api-key'].includes(authMode)
      ? [{
          key: 'credential',
          label: fallbackCredentialLabel,
          placeholder: c.auth?.credentialPlaceholder ?? '',
          description: c.auth?.credentialDescription ?? '',
          helpLabel: c.auth?.credentialHelpLabel ?? '',
          required: true,
          secret: true,
        }]
      : [];
  return {
    schemaVersion: c.schemaVersion ?? 1,
    id: c.id,
    name: c.name,
    vendor: c.vendor ?? '',
    icon: c.icon ?? '',
    category: c.category ?? '其他',
    summary: c.summary ?? '',
    description: c.description ?? '',
    tags: c.tags ?? [],
    published: c.published ?? true,
    featured: c.featured ?? false,
    homepage: c.homepage ?? '',
    promptVariables: c.promptVariables ?? [],
    prompts: c.prompts ?? [],
    probeStatus: c.probeStatus ?? 'unverified',
    probeCheckedAt: c.probeCheckedAt,
    probeReportUrl: c.probeReportUrl ?? '',
    toolsSnapshot: c.toolsSnapshot ?? [],
    auth: {
      mode: authMode,
      issuer: c.auth?.issuer ?? '',
      scope: c.auth?.scope ?? 'mcp:tools',
            clientName: c.auth?.clientName ?? 'DeepSeek Harness - MCP Connector',
      tokenEndpointAuthMethod: c.auth?.tokenEndpointAuthMethod ?? 'none',
      apiKeyHeader: c.auth?.apiKeyHeader ?? 'X-Api-Key',
      grantSharing: c.auth?.grantSharing ?? '',
      credentialName: c.auth?.credentialName ?? '',
      credentialPlaceholder: c.auth?.credentialPlaceholder ?? '',
      credentialDescription: c.auth?.credentialDescription ?? '',
      credentialHelpLabel: c.auth?.credentialHelpLabel ?? '',
      credentialFields,
    },
    servers,
  };
}

/** Normalize a ConnectionRecord */
export function normalizeConnectionRecord(raw) {
  const parsed = connectionRecordSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`invalid connection record: ${issues}`);
  }
  const data = parsed.data;
  const transport = data.transport === 'sse' ? 'streamable-http' : data.transport;
  if (transport === 'stdio' && !data.command) {
        throw new Error('invalid connection record: command is required when transport=stdio');
  }
  if (transport === 'streamable-http' && !data.url) {
        throw new Error('invalid connection record: url is required when transport=streamable-http');
  }
  const parsedUrl = transport === 'streamable-http'
    ? assertConnectionUrl(data.url, { allowInsecurePrivateNetwork: data.allowInsecurePrivateNetwork === true })
    : null;
  const allowInsecurePrivateNetwork = parsedUrl?.protocol === 'http:'
    && isPrivateNetworkHost(parsedUrl.hostname)
    && data.allowInsecurePrivateNetwork === true;
  return {
    ...data,
    transport,
    url: parsedUrl?.toString(),
    allowInsecurePrivateNetwork: allowInsecurePrivateNetwork || undefined,
    command: transport === 'stdio' ? data.command : undefined,
    args: transport === 'stdio' ? (data.args ?? []) : undefined,
    env: transport === 'stdio' ? (data.env ?? {}) : undefined,
    oauthTokenEnv: transport === 'stdio' && data.auth?.mode === 'oauth' ? data.oauthTokenEnv : undefined,
    cwd: transport === 'stdio' ? (data.cwd ?? '') : undefined,
    headers: transport === 'streamable-http' ? (data.headers ?? {}) : {},
    auth: transport === 'stdio' && data.auth?.mode !== 'oauth' ? undefined : data.auth,
  };
}
