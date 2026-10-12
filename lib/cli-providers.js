import { spawn } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

const MAX_OUTPUT_BYTES = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const WRITE_VERBS = new Set([
  'add', 'approve', 'create', 'delete', 'disable', 'done', 'enable', 'insert',
  'invite', 'move', 'recall', 'reject', 'remove', 'rename', 'reply', 'revoke',
  'send', 'switch', 'update', 'upload',
]);

function stringField(flag, options = {}) {
  return { flag, type: 'string', ...options };
}

function integerField(flag, options = {}) {
  return { flag, type: 'integer', ...options };
}

function booleanField(flag, options = {}) {
  return { flag, type: 'boolean', ...options };
}

function stringArrayField(flag, options = {}) {
  return { flag, type: 'string-array', ...options };
}

const profileField = stringField('--profile', {
  global: true,
  description: 'Optional DingTalk account profile (corpId:userId is recommended). When omitted, the current dws profile is used.',
});

function readTool(name, description, command, fields = {}) {
  return { name, description, command, fields, readOnly: true };
}

const dingtalkDwsTools = [
  readTool(
    'dingtalk_get_current_user',
    'Read the user, organization and department information of the current DingTalk OAuth identity.',
    ['contact', 'user', 'get-self'],
    { profile: profileField },
  ),
  readTool(
    'dingtalk_search_users',
    'Search the DingTalk enterprise contacts read-only by keyword. When several people share a name, present the candidates and never pick one automatically.',
    ['contact', 'user', 'search'],
    {
      profile: profileField,
      query: stringField('--query', { required: true, description: 'Name, job title or contacts keyword.' }),
    },
  ),
  readTool(
    'dingtalk_get_users',
    'Read DingTalk user profiles in bulk by one or more userId values.',
    ['contact', 'user', 'get'],
    {
      profile: profileField,
      ids: stringArrayField('--ids', { required: true, description: 'List of DingTalk userId values.' }),
    },
  ),
  readTool(
    'dingtalk_list_calendar_events',
    'List the DingTalk calendar events of the current user within a given time range, read-only; when no time range is given, dws applies its default range.',
    ['calendar', 'event', 'list'],
    {
      profile: profileField,
      start: stringField('--start', { description: 'ISO 8601 start time.' }),
      end: stringField('--end', { description: 'ISO 8601 end time.' }),
    },
  ),
  readTool(
    'dingtalk_get_calendar_event',
    'Read the details of a DingTalk calendar event by calendar event ID, read-only.',
    ['calendar', 'event', 'get'],
    {
      profile: profileField,
      id: stringField('--id', { required: true, description: 'Calendar event ID.' }),
    },
  ),
  readTool(
    'dingtalk_list_todos',
    'List the DingTalk to-do items of the current user, read-only.',
    ['todo', 'task', 'list'],
    {
      profile: profileField,
      page: integerField('--page', { minimum: 1, maximum: 10000, description: 'Page number.' }),
      size: integerField('--size', { minimum: 1, maximum: 100, description: 'Items per page.' }),
      completed: booleanField('--status', { description: 'true for completed only, false for not completed only; omit for no filtering.' }),
    },
  ),
  readTool(
    'dingtalk_get_todo',
    'Read the details of a DingTalk to-do item by to-do ID, read-only.',
    ['todo', 'task', 'get'],
    {
      profile: profileField,
      taskId: stringField('--task-id', { required: true, description: 'To-do task ID.' }),
    },
  ),
  readTool(
    'dingtalk_search_documents',
    'Search the DingTalk files and documents that the current user is allowed to access, read-only.',
    ['drive', 'search'],
    {
      profile: profileField,
      query: stringField('--query', { required: true, description: 'Keyword from the file or document title or content.' }),
    },
  ),
  readTool(
    'dingtalk_list_pending_approvals',
    'List the pending DingTalk OA approval instances of the current user within a given time range, read-only; this never approves or rejects them.',
    ['oa', 'approval', 'list-pending'],
    {
      profile: profileField,
      start: stringField('--start', { required: true, description: 'ISO 8601 start time.' }),
      end: stringField('--end', { required: true, description: 'ISO 8601 end time.' }),
      page: integerField('--page', { minimum: 1, maximum: 10000, description: 'Page number.' }),
      limit: integerField('--limit', { minimum: 1, maximum: 100, description: 'Items per page.' }),
    },
  ),
  readTool(
    'dingtalk_list_reports',
    'List the DingTalk reports received by the current user within a given time range, read-only.',
    ['report', 'inbox', 'list'],
    {
      profile: profileField,
      start: stringField('--start', { required: true, description: 'ISO 8601 start time.' }),
      end: stringField('--end', { required: true, description: 'ISO 8601 end time.' }),
      cursor: integerField('--cursor', { minimum: 0, description: 'Pagination cursor.' }),
      size: integerField('--size', { minimum: 1, maximum: 20, description: 'Number of results returned.' }),
    },
  ),
  readTool(
    'dingtalk_list_report_templates',
    'List the DingTalk report templates available to the current user, read-only.',
    ['report', 'template', 'list'],
    { profile: profileField },
  ),
];

export const CLI_PROVIDERS = Object.freeze({
  'dingtalk-dws': Object.freeze({
    id: 'dingtalk-dws',
    name: 'DingTalk Workspace CLI',
    executable: 'dws',
    homepage: 'https://github.com/DingTalk-Real-AI/dingtalk-workspace-cli',
    preflight: Object.freeze(['auth', 'status']),
    tools: Object.freeze(dingtalkDwsTools),
  }),
});

function inputSchema(tool) {
  const properties = {};
  const required = [];
  for (const [name, field] of Object.entries(tool.fields)) {
    const schema = { description: field.description };
    if (field.type === 'integer') {
      schema.type = 'integer';
      if (field.minimum !== undefined) schema.minimum = field.minimum;
      if (field.maximum !== undefined) schema.maximum = field.maximum;
    } else if (field.type === 'boolean') {
      schema.type = 'boolean';
    } else if (field.type === 'string-array') {
      schema.type = 'array';
      schema.items = { type: 'string', minLength: 1 };
      schema.minItems = 1;
      schema.maxItems = 100;
    } else {
      schema.type = 'string';
      schema.minLength = 1;
    }
    properties[name] = schema;
    if (field.required) required.push(name);
  }
  return {
    type: 'object',
    properties,
    additionalProperties: false,
    ...(required.length ? { required } : {}),
  };
}

export function listCliProviderTools(providerId) {
  const provider = CLI_PROVIDERS[providerId];
  if (!provider) throw new Error(`unknown CLI provider: ${providerId}`);
  return provider.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: inputSchema(tool),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  }));
}

function assertSafeExecutable(executable) {
  const value = String(executable ?? '').trim();
  if (!value || /[\0\r\n]/.test(value) || (/\s/.test(value) && !path.isAbsolute(value) && !path.win32.isAbsolute(value))) {
    throw new Error('CLI executable must be one command name or an absolute path');
  }
  return value;
}

function validateField(name, value, field) {
  if (value === undefined || value === null || value === '') {
    if (field.required) throw new Error(`missing required argument: ${name}`);
    return undefined;
  }
  if (field.type === 'string') {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string`);
    if (/[\0\r\n]/.test(value)) throw new Error(`${name} contains forbidden control characters`);
    return value;
  }
  if (field.type === 'integer') {
    if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`);
    if (field.minimum !== undefined && value < field.minimum) throw new Error(`${name} must be >= ${field.minimum}`);
    if (field.maximum !== undefined && value > field.maximum) throw new Error(`${name} must be <= ${field.maximum}`);
    return String(value);
  }
  if (field.type === 'boolean') {
    if (typeof value !== 'boolean') throw new Error(`${name} must be a boolean`);
    return String(value);
  }
  if (field.type === 'string-array') {
    if (!Array.isArray(value) || !value.length || value.length > 100) {
      throw new Error(`${name} must be an array containing 1-100 strings`);
    }
    const values = value.map((item) => {
      if (typeof item !== 'string' || !item.trim() || /[\0\r\n,]/.test(item)) {
        throw new Error(`${name} contains an invalid item`);
      }
      return item;
    });
    return values.join(',');
  }
  throw new Error(`unsupported field type for ${name}`);
}

export function buildCliInvocation(providerId, toolName, input = {}, options = {}) {
  const provider = CLI_PROVIDERS[providerId];
  if (!provider) throw new Error(`unknown CLI provider: ${providerId}`);
  const tool = provider.tools.find((candidate) => candidate.name === toolName);
  if (!tool) throw new Error(`unknown tool for ${providerId}: ${toolName}`);
  if (!tool.readOnly || tool.command.some((part) => WRITE_VERBS.has(part))) {
    throw new Error(`CLI provider tool is not approved for read-only execution: ${toolName}`);
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('tool arguments must be an object');
  }
  const unknown = Object.keys(input).filter((key) => !Object.hasOwn(tool.fields, key));
  if (unknown.length) throw new Error(`unknown tool arguments: ${unknown.join(', ')}`);

  const globalArgs = [];
  const commandArgs = [];
  for (const [name, field] of Object.entries(tool.fields)) {
    const value = validateField(name, input[name], field);
    if (value === undefined) continue;
    const target = field.global ? globalArgs : commandArgs;
    target.push(field.flag, value);
  }
  return {
    command: assertSafeExecutable(options.executable ?? process.env.DSH_MCP_DINGTALK_DWS_BIN ?? provider.executable),
    args: [...globalArgs, ...tool.command, ...commandArgs, '--format', 'json'],
    provider,
    tool,
  };
}

export function buildCliPreflightInvocation(providerId, options = {}) {
  const provider = CLI_PROVIDERS[providerId];
  if (!provider) throw new Error(`unknown CLI provider: ${providerId}`);
  if (!Array.isArray(provider.preflight) || !provider.preflight.length) return null;
  if (provider.preflight.some((part) => WRITE_VERBS.has(part))) {
    throw new Error(`CLI provider preflight is not approved for read-only execution: ${providerId}`);
  }
  return {
    command: assertSafeExecutable(options.executable ?? process.env.DSH_MCP_DINGTALK_DWS_BIN ?? provider.executable),
    args: [...provider.preflight, '--format', 'json'],
  };
}

export function redactCliError(value) {
  return String(value ?? '')
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s"']+/gi, '$1[REDACTED]')
    .replace(/(["']?(?:(?:access|refresh)[_-]?token|client[_-]?secret|app[_-]?secret)["']?\s*[=:]\s*["']?)[^\s,"'}]+/gi, '$1[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [REDACTED]')
    .trim();
}

// Resolve only the known provider package; never interpret or execute a shell shim.
export function resolveCliExecutable(command, options = {}) {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  if (platform !== 'win32') return command;
  if (/\.(cmd|bat|ps1)$/i.test(command)) throw new Error('[CLI_SHIM_UNSUPPORTED] Specify the native exe instead of a shell launcher script');
  if (command !== 'dws') return command; // Explicit override stays authoritative.
  const pathValue = Object.entries(env).find(([key]) => key.toLowerCase() === 'path')?.[1] ?? '';
  let sawShim = false;
  for (const raw of pathValue.split(';')) {
    const dir = raw.replace(/^"(.*)"$/, '$1');
    if (!path.isAbsolute(dir)) continue; // Never search cwd or relative PATH entries.
    const native = path.join(dir, 'dws.exe');
    if (existsSync(native) && statSync(native).isFile()) return native;
    if (existsSync(path.join(dir, 'dws.cmd'))) sawShim = true;
    const roots = path.basename(dir).toLowerCase() === '.bin'
      ? [path.join(dir, '..', 'dingtalk-workspace-cli')]
      : [path.join(dir, 'node_modules', 'dingtalk-workspace-cli')];
    for (const root of roots) {
      if (!existsSync(path.join(root, 'package.json'))) continue;
      try {
        const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
        if (pkg.name !== 'dingtalk-workspace-cli' || pkg.bin?.dws !== 'bin/dws.js') continue;
        const realRoot = realpathSync(root);
        const binary = realpathSync(path.join(root, 'vendor', 'dws.exe'));
        const relative = path.relative(realRoot, binary);
        if (relative.startsWith('..') || path.isAbsolute(relative) || !statSync(binary).isFile()) continue;
        return binary;
      } catch { /* Missing/corrupt packages must fail closed, not launch a shim. */ }
    }
  }
  throw new Error(sawShim
    ? '[CLI_NATIVE_MISSING] A dws npm launcher script was found, but no valid official native binary; check the CLI installation, or point DSH_MCP_DINGTALK_DWS_BIN at dws.exe'
    : '[CLI_NOT_FOUND] No dws native binary or official npm package was found in the PATH of the DSH process; check the installation and the DSH environment, then restart; this does not mean that OAuth is not logged in');
}

export function runCliProcess(command, args, options = {}) {
  const timeoutMs = Number.isInteger(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const maxOutputBytes = Number.isInteger(options.maxOutputBytes) ? options.maxOutputBytes : MAX_OUTPUT_BYTES;
  return new Promise((resolve, reject) => {
    const executable = resolveCliExecutable(command, options);
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: options.env ?? process.env,
    });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      fail(new Error(`CLI command timed out after ${timeoutMs}ms`));
    }, Math.max(1000, Math.min(timeoutMs, 300_000)));

    child.once('error', (error) => {
      if (error?.code === 'ENOENT') {
        fail(new Error(`The official CLI command "${command}" was not found; complete the installation and the OAuth login first, then restart DSH`));
        return;
      }
      fail(error);
    });
    child.stdout.on('data', (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > maxOutputBytes) {
        child.kill('SIGTERM');
        fail(new Error(`CLI stdout exceeded ${maxOutputBytes} bytes`));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderrBytes += chunk.length;
      if (stderrBytes <= maxOutputBytes) stderr.push(chunk);
    });
    child.once('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const output = Buffer.concat(stdout).toString('utf8').trim();
      const errorOutput = redactCliError(Buffer.concat(stderr).toString('utf8'));
      if (code !== 0) {
        const hint = {
          2: 'Authentication or authorization failed; run dws auth login and confirm that the organization administrator has enabled CLI access',
          3: 'The arguments did not pass validation for the currently pinned dws version; check the tool arguments or upgrade the MCP connector catalog',
          4: 'DingTalk requires an additional permission authorization; complete the official authorization prompt and retry',
          6: 'The dws command or service discovery failed; check the network, the login state and the MCP connector catalog version',
        }[code] ?? '';
        const details = [hint, errorOutput, signal ? `signal=${signal}` : ''].filter(Boolean).join('; ');
        reject(new Error(`CLI command failed with exit code ${code}${details ? `: ${details}` : ''}`));
        return;
      }
      resolve(output);
    });
  });
}

export async function executeCliProviderTool(providerId, toolName, input = {}, options = {}) {
  const invocation = buildCliInvocation(providerId, toolName, input, options);
  const runner = options.runner ?? runCliProcess;
  const output = await runner(invocation.command, invocation.args, options);
  let normalized = redactCliError(output || '{"ok":true}');
  try {
    normalized = JSON.stringify(JSON.parse(normalized), null, 2);
  } catch {
    // Keep non-JSON success output readable; dws normally emits JSON with --format json.
  }
  return {
    content: [{ type: 'text', text: normalized }],
    isError: false,
  };
}

export async function ensureCliProviderReady(providerId, options = {}) {
  const invocation = buildCliPreflightInvocation(providerId, options);
  if (!invocation) return;
  const runner = options.runner ?? runCliProcess;
  const output = await runner(invocation.command, invocation.args, options);
  // Exit code 0 / success:true means the status query succeeded, not that
  // the user is authenticated. Never expose the raw status (identity/tokens).
  let status;
  try {
    status = JSON.parse(output);
  } catch {
    throw new Error('[CLI_AUTH_STATUS_INVALID] Unable to verify the DingTalk OAuth state: the official CLI did not return valid JSON; check the CLI version and retry');
  }
  if (status?.success === true && status?.authenticated === false) {
    throw new Error('[CLI_AUTH_REQUIRED] DingTalk authorization is pending: the official CLI is not currently logged in. Once the organization makes CLI authorization available, run npx -y dingtalk-workspace-cli@1.0.61 auth login in a terminal for the same system user that runs DSH. If you already know that the organization has not opened CLI access, wait for the administrator instead of repeatedly logging in, restarting or entering an API Key; a logged-out state alone does not tell you whether the administrator is restricting access');
  }
  if (!status || typeof status !== 'object' || Array.isArray(status)
    || status.success !== true || status.authenticated !== true) {
    throw new Error('[CLI_AUTH_STATUS_INVALID] Unable to confirm the DingTalk authorization state: the official CLI returned a failed or incomplete status response; check the CLI diagnostics; this alone does not indicate a logged-out state or an administrator restriction');
  }
}

// Upgrade only the exact managed legacy invocation; preserve custom commands,
// environment, cwd and credentials. Applied on every provision, including restore.
export function cliBridgeArgs(record) {
  const legacy = ['--yes', '--legacy-peer-deps', '--package', argsVersion(record),
    '--package', 'dingtalk-workspace-cli@1.0.61', 'dsh-mcp-cli-bridge', '--provider', 'dingtalk-dws'];
  const args = record.args ?? [];
  if (!legacy[3] || record.connectorId !== 'dingtalk' || record.command !== 'npx'
    || JSON.stringify(args) !== JSON.stringify(legacy)) return args;
  return args.map((arg) => arg === legacy[3] ? 'dsh-mcp-connector@0.2.55' : arg);
}

function argsVersion(record) {
  const value = record.args?.[3];
  return ['dsh-mcp-connector@0.2.48', 'dsh-mcp-connector@0.2.49'].includes(value) ? value : null;
}

export async function handleCliBridgeRequest(message, options = {}) {
  const providerId = options.providerId ?? 'dingtalk-dws';
  if (!message || typeof message !== 'object') throw new Error('invalid JSON-RPC message');
  if (!Object.hasOwn(message, 'id')) return null;
  const base = { jsonrpc: '2.0', id: message.id };
  try {
    if (message.method === 'initialize') {
      return {
        ...base,
        result: {
          protocolVersion: message.params?.protocolVersion ?? '2025-06-18',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: `dsh-mcp-cli-bridge/${providerId}`, version: '1.0.0' },
        },
      };
    }
    if (message.method === 'ping') return { ...base, result: {} };
    if (message.method === 'tools/list') {
      try {
        const preflight = options.preflight ?? ensureCliProviderReady;
        await preflight(providerId, options);
      } catch (error) {
        return {
          ...base,
          error: {
            code: -32001,
            message: `CLI provider is not ready: ${redactCliError(error?.message ?? error)}`,
          },
        };
      }
      return { ...base, result: { tools: listCliProviderTools(providerId) } };
    }
    if (message.method === 'tools/call') {
      const name = message.params?.name;
      const args = message.params?.arguments ?? {};
      try {
        const execute = options.execute ?? executeCliProviderTool;
        return { ...base, result: await execute(providerId, name, args, options) };
      } catch (error) {
        return {
          ...base,
          result: {
            content: [{ type: 'text', text: redactCliError(error?.message ?? error) }],
            isError: true,
          },
        };
      }
    }
    return { ...base, error: { code: -32601, message: `Method not found: ${message.method}` } };
  } catch (error) {
    return { ...base, error: { code: -32603, message: redactCliError(error?.message ?? error) } };
  }
}
