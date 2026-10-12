import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  connectionRecordSchema,
  normalizeConnectorDescriptor,
  normalizeConnectionRecord,
  serverRefSchema,
} from '../lib/schema.js';
import { auditDescriptor, auditRawDescriptor } from '../lib/catalog.js';
import { normalizeJsonImport } from '../lib/connectors/json-connector.js';
import { buildManualRecord } from '../lib/connectors/manual-connector.js';
import { resourceMetadataUrlFallback } from '../lib/oauth.js';
import { normalizeConnectionDisplayName } from '../lib/util.js';
import { buildEntryConfig } from '../lib/mcp-provision.js';

test('Zod 4.1 compatible: non-empty env, headers and credentialBindings parse before domain open', () => {
  const server = serverRefSchema.parse({
    serverKey: 'stdio',
    command: 'vendor-mcp',
    serverName: 'vendor',
    env: { LOG_LEVEL: 'info' },
    credentialBindings: { VENDOR_TOKEN: 'apiToken' },
    headers: { 'X-Region': 'cn' },
  });
  assert.deepEqual(server.env, { LOG_LEVEL: 'info' });
  assert.deepEqual(server.credentialBindings, { VENDOR_TOKEN: 'apiToken' });
  assert.deepEqual(server.headers, { 'X-Region': 'cn' });

  const record = connectionRecordSchema.parse({
    key: 'vendor-main',
    connectorId: 'vendor',
    kind: 'json',
    name: 'Vendor',
    transport: 'stdio',
    command: 'vendor-mcp',
    serverName: 'vendor',
    env: { VENDOR_TOKEN: 'redacted-test-value' },
    headers: { 'X-Region': 'cn' },
    createdAt: 1,
    updatedAt: 1,
  });
  assert.deepEqual(record.env, { VENDOR_TOKEN: 'redacted-test-value' });
  assert.deepEqual(record.headers, { 'X-Region': 'cn' });
});

test('normalizeConnectorDescriptor fills in defaults', () => {
  const d = normalizeConnectorDescriptor({
    id: 'acme',
    name: 'ACME',
    auth: { mode: 'oauth2-pkce', issuer: 'https://auth.example.com' },
    servers: [{ serverKey: 'a', url: 'https://mcp.example.com/stream', serverName: 'acme-a' }],
  });
  assert.equal(d.id, 'acme');
  assert.equal(d.category, '其他');
  assert.equal(d.published, true);
  assert.equal(d.featured, false);
  assert.equal(d.auth.mode, 'oauth2-pkce');
  assert.equal(d.auth.scope, 'mcp:tools');
  assert.equal(d.auth.clientName, 'DeepSeek Harness - MCP Connector');
  assert.equal(d.servers[0].transport, 'streamable-http');
  assert.equal(d.probeStatus, 'unverified');
  assert.deepEqual(d.promptVariables, []);
  assert.deepEqual(d.toolsSnapshot, []);
});

test('normalizeConnectorDescriptor accepts parameterized prompts and tool snapshots', () => {
  const d = normalizeConnectorDescriptor({
    id: 'templated', name: 'Templated',
    auth: {
      mode: 'bearer',
      credentialName: 'Vendor Access Token',
      credentialPlaceholder: '请输入 Token',
      credentialDescription: '仅保存在本机',
      credentialHelpLabel: '如何获取 Token？',
    },
    promptVariables: [{ name: 'company', label: '企业名称', required: true }],
    prompts: [{ title: '查询', text: '查询 {{company}}' }],
    probeStatus: 'pass',
    toolsSnapshot: [{ serverKey: 'main', tools: [{ name: 'search', description: '查询' }] }],
    servers: [{ serverKey: 'main', url: 'https://mcp.example.com/stream', serverName: 'templated' }],
  });
  assert.equal(d.promptVariables[0].name, 'company');
  assert.equal(d.auth.credentialName, 'Vendor Access Token');
  assert.equal(d.auth.credentialPlaceholder, '请输入 Token');
  assert.equal(d.auth.credentialDescription, '仅保存在本机');
  assert.equal(d.auth.credentialHelpLabel, '如何获取 Token？');
  assert.deepEqual(d.auth.credentialFields, [{
    key: 'credential',
    label: 'Vendor Access Token',
    placeholder: '请输入 Token',
    description: '仅保存在本机',
    helpLabel: '如何获取 Token？',
    required: true,
    secret: true,
  }]);
  assert.equal(d.probeStatus, 'pass');
  assert.equal(d.toolsSnapshot[0].tools[0].name, 'search');
});

test('normalizeConnectorDescriptor rejects a descriptor without servers', () => {
  assert.throws(() => normalizeConnectorDescriptor({ id: 'x', name: 'X' }), /servers/);
});

test('auditDescriptor rejects secret-like headers in the catalog', () => {
  assert.throws(
    () =>
      auditDescriptor(
        normalizeConnectorDescriptor({
          id: 'x',
          name: 'X',
          servers: [
            { serverKey: 'a', url: 'https://mcp.example.com/stream', serverName: 'x-a', headers: { Authorization: 'Bearer secret' } },
          ],
        }),
      ),
    /must not carry secret-like headers/,
  );
});

test('normalizeJsonImport: mcpServers format + Bearer promotion', () => {
  const { records, skipped } = normalizeJsonImport({
    mcpServers: {
      'my-vendor': {
        type: 'streamable-http',
        url: 'https://vendor.example.com/mcp/stream',
        headers: { Authorization: 'Bearer tok123', 'X-Extra': '1' },
      },
    },
  });
  assert.equal(records.length, 1);
  assert.equal(skipped.length, 0);
  const r = records[0];
  assert.equal(r.kind, 'json');
  assert.equal(r.serverName, 'my-vendor');
  assert.equal(r.auth.mode, 'bearer');
  assert.equal(r.auth.bearerToken, 'tok123');
  assert.equal(r.headers['X-Extra'], '1');
  assert.equal('Authorization' in r.headers, false);
});

test('connection display name trims and rejects empty, control characters and overlong values', () => {
  assert.equal(normalizeConnectionDisplayName('  生产数据  '), '生产数据');
  assert.throws(() => normalizeConnectionDisplayName('  '), /cannot be empty/);
  assert.throws(() => normalizeConnectionDisplayName('生产\n数据'), /control characters/);
  assert.throws(() => normalizeConnectionDisplayName('x'.repeat(81)), /80/);
  assert.equal(normalizeConnectionDisplayName('📦'.repeat(80)), '📦'.repeat(80));
});

test('normalizeJsonImport: connections format api-key', () => {
  const { records } = normalizeJsonImport({
    connections: [
      { name: '地图', url: 'https://mcp.example.com/stream', serverName: 'geo', authMode: 'api-key', apiKeyHeader: 'X-Key', apiKeyValue: 'v1' },
    ],
  });
  assert.equal(records.length, 1);
  assert.equal(records[0].auth.mode, 'api-key');
  assert.equal(records[0].auth.apiKeyValue, 'v1');
});

test('connection record and import support always/session injection modes', () => {
  const legacy = normalizeConnectionRecord({
    key: 'legacy', connectorId: 'legacy', kind: 'manual', name: 'Legacy',
    transport: 'streamable-http', url: 'https://example.com/mcp', serverName: 'legacy',
    createdAt: 1, updatedAt: 1,
  });
  assert.equal(legacy.injectionMode, undefined, '旧记录保持可读，运行时按 always 解释');
  assert.equal(connectionRecordSchema.parse({ ...legacy, injectionMode: 'session' }).injectionMode, 'session');
  assert.throws(() => connectionRecordSchema.parse({ ...legacy, injectionMode: 'keyword' }), /injectionMode/);

  const { records } = normalizeJsonImport({
    connections: [{ name: 'Session', url: 'https://example.com/mcp', injectionMode: 'session' }],
  });
  assert.equal(records[0].injectionMode, 'session');
  assert.equal(buildManualRecord({ name: 'Always', url: 'https://example.com/mcp' }).injectionMode, 'always');
});

test('normalizeJsonImport: LAN HTTP requires per-entry explicit authorization', () => {
  assert.throws(
    () => normalizeJsonImport({ mcpServers: { lan: { url: 'http://192.168.31.138:8188/mcp' } } }),
    /explicit confirmation/,
  );
  const { records } = normalizeJsonImport({
    mcpServers: {
      lan: {
        url: 'http://192.168.31.138:8188/mcp',
        allowInsecurePrivateNetwork: true,
      },
    },
  });
  assert.equal(records[0].url, 'http://192.168.31.138:8188/mcp');
  assert.equal(records[0].allowInsecurePrivateNetwork, true);
});

test('normalizeJsonImport: stdio passthrough + missing url skipped', () => {
  const { records, skipped } = normalizeJsonImport({
    mcpServers: {
      local: { command: 'npx', args: ['-y', 'x'], env: { LOG_LEVEL: 'info' }, cwd: '/tmp' },
      broken: { type: 'streamable-http' },
      ok: { url: 'https://mcp.example.com/stream' },
    },
  });
  assert.equal(records.length, 2);
  assert.equal(skipped.length, 1);
  assert.equal(records[0].transport, 'stdio');
  assert.equal(records[0].command, 'npx');
  assert.deepEqual(records[0].args, ['-y', 'x']);
  assert.deepEqual(records[0].env, { LOG_LEVEL: 'info' });
  assert.equal(records[0].cwd, '/tmp');
  assert.ok(skipped.some((s) => s.includes('missing url')));
});

test('normalizeJsonImport: throws when everything is skipped', () => {
  assert.throws(
    () => normalizeJsonImport({ mcpServers: { local: { type: 'stdio' } } }),
    /no importable connections/,
  );
});

test('stdio descriptor validation, SSE normalization and catalog env secret audit', () => {
  const descriptor = normalizeConnectorDescriptor({
    id: 'local-tools', name: 'Local Tools', auth: { mode: 'none' },
    servers: [{ serverKey: 'main', transport: 'stdio', command: 'npx', args: ['-y', 'server'], serverName: 'local-tools' }],
  });
  assert.equal(descriptor.servers[0].transport, 'stdio');
  assert.equal(descriptor.servers[0].url, undefined);
  assert.throws(() => normalizeConnectorDescriptor({
    id: 'bad', name: 'Bad', servers: [{ serverKey: 'main', transport: 'stdio', serverName: 'bad' }],
  }), /command is required/);
  assert.equal(normalizeConnectorDescriptor({
    id: 'legacy', name: 'Legacy', servers: [{ serverKey: 'main', transport: 'sse', url: 'https://mcp.example.com/sse', serverName: 'legacy' }],
  }).servers[0].transport, 'streamable-http');
  assert.throws(() => auditDescriptor(normalizeConnectorDescriptor({
    id: 'secret-env', name: 'Secret env', auth: { mode: 'none' },
    servers: [{ serverKey: 'main', transport: 'stdio', command: 'npx', env: { GITHUB_TOKEN: 'x' }, serverName: 'secret-env' }],
  })), /env.*must not carry secret-like variables/);
});

test('stdio marketplace credentials declare only fields and env bindings, multi-field supported, bad references rejected', () => {
  const raw = {
    id: 'stdio-credential', name: 'Stdio Credential',
    auth: {
      mode: 'api-key',
      credentialFields: [
        { key: 'apiToken', label: 'API Token', required: true, secret: true },
        { key: 'region', label: '区域', required: true, secret: false },
      ],
    },
    servers: [{
      serverKey: 'main', transport: 'stdio', command: 'uvx', args: ['vendor-mcp'],
      env: { LOG_LEVEL: 'info' },
      credentialBindings: { VENDOR_API_TOKEN: 'apiToken', VENDOR_REGION: 'region' },
      serverName: 'stdio-credential',
    }],
  };
  assert.doesNotThrow(() => auditRawDescriptor(raw));
  const descriptor = auditDescriptor(normalizeConnectorDescriptor(raw));
  assert.deepEqual(descriptor.servers[0].credentialBindings, {
    VENDOR_API_TOKEN: 'apiToken',
    VENDOR_REGION: 'region',
  });
  assert.equal(descriptor.auth.credentialFields[1].secret, false);

  const unknown = structuredClone(raw);
  unknown.servers[0].credentialBindings.VENDOR_API_TOKEN = 'missing';
  assert.throws(() => auditDescriptor(normalizeConnectorDescriptor(unknown)), /unknown credential field/);

  const staticSecret = structuredClone(raw);
  staticSecret.servers[0].env.VENDOR_API_TOKEN = 'must-not-be-in-catalog';
  assert.throws(() => auditDescriptor(normalizeConnectorDescriptor(staticSecret)), /env.*must not carry secret-like variables/);
});

test('OAuth stdio may only inject tokens into declared env vars from an HTTP resource of the same connector', () => {
  const raw = {
    id: 'oauth-stdio', name: 'OAuth stdio',
    auth: { mode: 'oauth2-pkce', issuer: 'https://agent.example.com' },
    servers: [
      { serverKey: 'remote', url: 'https://agent.example.com/mcp/document/stream', serverName: 'document', transport: 'streamable-http' },
      {
        serverKey: 'local', transport: 'stdio', command: 'npx', args: ['-y', 'document-mcp'],
        serverName: 'document-local', oauthResource: 'https://agent.example.com/mcp/document/stream',
        oauthTokenEnv: 'DOCUMENT_AUTHORIZATION',
      },
    ],
  };
  const descriptor = auditDescriptor(normalizeConnectorDescriptor(raw));
  assert.equal(descriptor.servers[1].oauthResource, raw.servers[1].oauthResource);
  assert.equal(descriptor.servers[1].oauthTokenEnv, 'DOCUMENT_AUTHORIZATION');

  const missingBinding = structuredClone(raw);
  delete missingBinding.servers[1].oauthTokenEnv;
  assert.throws(() => auditDescriptor(normalizeConnectorDescriptor(missingBinding)), /must declare oauthResource and oauthTokenEnv/);

  const foreignResource = structuredClone(raw);
  foreignResource.servers[1].oauthResource = 'https://other.example.com/mcp';
  assert.throws(() => auditDescriptor(normalizeConnectorDescriptor(foreignResource)), /an HTTP resource of the same connector/);

  const conflictingBinding = structuredClone(raw);
  conflictingBinding.servers[1].credentialBindings = { DOCUMENT_AUTHORIZATION: 'credential' };
  assert.throws(() => auditDescriptor(normalizeConnectorDescriptor(conflictingBinding)), /must not declare credentialBindings at the same time/);
});

test('legacy connection record: SSE normalized, stdio fields preserved', () => {
  const base = { key: 'x', connectorId: 'x', kind: 'json', name: 'X', serverName: 'x', createdAt: 1, updatedAt: 1 };
  assert.equal(normalizeConnectionRecord({ ...base, transport: 'sse', url: 'https://mcp.example.com/sse' }).transport, 'streamable-http');
  const stdio = normalizeConnectionRecord({ ...base, transport: 'stdio', command: 'uvx', args: ['server'], env: { MODE: 'test' } });
  assert.equal(stdio.command, 'uvx');
  assert.deepEqual(stdio.env, { MODE: 'test' });
  const staleAuth = normalizeConnectionRecord({
    ...base, transport: 'stdio', command: 'uvx', auth: { mode: 'bearer', bearerToken: 'must-not-pass' },
  });
  assert.equal(staleAuth.auth, undefined);
  const oauthStdio = normalizeConnectionRecord({
    ...base, transport: 'stdio', command: 'npx', oauthTokenEnv: 'DOCUMENT_AUTHORIZATION',
    auth: { mode: 'oauth', grantKey: 'grant:test' },
  });
  assert.deepEqual(oauthStdio.auth, { mode: 'oauth', grantKey: 'grant:test' });
  assert.equal(oauthStdio.oauthTokenEnv, 'DOCUMENT_AUTHORIZATION');
  const lan = normalizeConnectionRecord({
    ...base,
    transport: 'streamable-http',
    url: 'http://10.0.0.8/mcp',
    allowInsecurePrivateNetwork: true,
  });
  assert.equal(lan.allowInsecurePrivateNetwork, true);
  assert.throws(
    () => normalizeConnectionRecord({ ...base, transport: 'streamable-http', url: 'http://10.0.0.8/mcp' }),
    /explicit confirmation/,
  );
});

test('buildManualRecord: bearer / api-key / none', () => {
  const bearer = buildManualRecord({ name: 'A', url: 'https://mcp.example.com/stream', authMode: 'bearer', bearerToken: 't' });
  assert.equal(bearer.auth.mode, 'bearer');
  const apikey = buildManualRecord({ name: 'B', url: 'https://mcp.example.com/stream', authMode: 'api-key', apiKeyValue: 'v' });
  assert.equal(apikey.auth.mode, 'api-key');
  assert.equal(apikey.auth.apiKeyHeader, 'X-Api-Key');
  const none = buildManualRecord({ name: 'C', url: 'https://mcp.example.com/stream' });
  assert.equal(none.auth, undefined);
});

test('buildManualRecord: LAN HTTP rejected by default, only explicitly authorized private IP literals allowed', () => {
  assert.throws(() => buildManualRecord({ name: 'LAN', url: 'http://192.168.31.138:8188/mcp' }), /explicit confirmation/);
  const lan = buildManualRecord({
    name: 'LAN',
    url: 'http://192.168.31.138:8188/mcp',
    allowInsecurePrivateNetwork: true,
  });
  assert.equal(lan.allowInsecurePrivateNetwork, true);
  assert.equal(lan.url, 'http://192.168.31.138:8188/mcp');
  const ula = buildManualRecord({ name: 'ULA', url: 'http://[fd12::8]/mcp', allowInsecurePrivateNetwork: true });
  assert.equal(ula.allowInsecurePrivateNetwork, true);
  assert.throws(() => buildManualRecord({ name: 'A', url: 'http://evil.example.com/stream' }), /protocol/);
  assert.throws(() => buildManualRecord({ name: 'A', url: 'http://evil.example.com/stream', allowInsecurePrivateNetwork: true }), /protocol/);
  assert.throws(() => buildManualRecord({ name: 'Link local', url: 'http://169.254.169.254/latest', allowInsecurePrivateNetwork: true }), /protocol/);
  assert.throws(() => buildManualRecord({ name: 'A', url: 'ftp://x/stream' }), /protocol|invalid url/);
});

test('buildManualRecord: serverName normalization', () => {
  const r = buildManualRecord({ name: 'My DB', url: 'https://mcp.example.com/stream', serverName: 'My-DB 2' });
  assert.equal(r.serverName, 'my-db-2');
});

test('buildManualRecord: stdio needs no URL and passes through local process fields', () => {
  const record = buildManualRecord({
    name: 'Local MCP', transport: 'stdio', command: 'npx', args: ['-y', 'server'],
    envJson: { SERVICE_TOKEN: 'local-only' }, cwd: '/tmp',
  });
  assert.equal(record.transport, 'stdio');
  assert.equal(record.url, undefined);
  assert.equal(record.command, 'npx');
  assert.deepEqual(record.args, ['-y', 'server']);
  assert.deepEqual(record.env, { SERVICE_TOKEN: 'local-only' });
  assert.throws(() => buildManualRecord({ name: 'Bad', transport: 'stdio' }), /command is required/);
});

test('buildEntryConfig: stdio passes through process fields only, no HTTP headers mixed in', () => {
  const config = buildEntryConfig({
    transport: 'stdio', serverName: 'local', command: 'uvx', args: ['server'],
    env: { MODE: 'test' }, cwd: '/tmp', headers: { Authorization: 'should-not-pass' },
  }, new Map());
  assert.deepEqual(config, {
    transport: 'stdio', serverName: 'local', command: 'uvx', args: ['server'],
    env: { MODE: 'test' }, cwd: '/tmp', failOnStartupError: false,
  });
  const strict = buildEntryConfig({
    transport: 'stdio', serverName: 'local', command: 'uvx', args: [], env: {}, cwd: '/tmp',
  }, new Map(), { failOnStartupError: true });
  assert.equal(strict.failOnStartupError, true);
});

test('buildEntryConfig: OAuth stdio injects the Bearer token at runtime only', () => {
  const record = {
    transport: 'stdio', serverName: 'document-local', command: 'npx', args: ['-y', 'document-mcp'],
    env: { LOG_LEVEL: 'info' }, oauthTokenEnv: 'DOCUMENT_AUTHORIZATION',
    auth: { mode: 'oauth', grantKey: 'grant:document' },
  };
  const config = buildEntryConfig(record, new Map([['grant:document', { accessToken: 'runtime-only-token' }]]));
  assert.deepEqual(config.env, {
    LOG_LEVEL: 'info',
    DOCUMENT_AUTHORIZATION: 'Bearer runtime-only-token',
  });
  assert.deepEqual(record.env, { LOG_LEVEL: 'info' }, '运行时注入不得污染持久化 record');
});

test('OAuth protected resource metadata fallback preserves the MCP path', () => {
  assert.equal(
    resourceMetadataUrlFallback('https://agent.example.com/mcp/company/stream'),
    'https://agent.example.com/mcp/.well-known/oauth-protected-resource/company/stream',
  );
});
