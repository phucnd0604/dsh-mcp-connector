/**
  * MCP connection governance: the three-layer connector/Server/Tool policy and its DSH Host enforcement.
 *
  * Policy resolves with "the more specific wins": Tool > Server > Connection > default allow.
  * A lifecycle-disabled connection record is physically taken offline; no allow rule can override it.
 */
import { createHash } from 'node:crypto';

export const GOVERNANCE_HISTORY_LIMIT = 20;
export const GOVERNANCE_SCOPES = ['connection', 'server', 'tool'];
export const GOVERNANCE_EFFECTS = ['allow', 'deny'];

const SOURCE_LABELS = {
  default: 'Default policy',
  connection: 'Connection policy',
  server: 'Server policy',
  tool: 'Tool policy',
  lifecycle: 'Connection disabled',
};

/**
  * A compatible implementation of the public naming contract of @deepseek-ai/dsh-mcp-client 0.1.1-rc.2.
  * That version exposes the function declarations and the algorithm in types/tools.d.ts, but its package root omits the exports;
  * keeping the algorithm in one place and pinned by contract tests, instead of inferring the raw name from the public one.
 */
export function publicToolName(serverName, rawName) {
  const joined = `mcp__${serverName}__${rawName}`;
  const normalized = joined.replace(/[^A-Za-z0-9_-]/g, '_');
  if (normalized === joined && normalized.length <= 64) return normalized;
  const hash = createHash('sha256').update(`${serverName}\0${rawName}`).digest('hex').slice(0, 12);
  return `${normalized.slice(0, 51)}_${hash}`;
}

function requiredText(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function cloneRules(rules) {
  return rules.map((rule) => ({ ...rule }));
}

function targetParts(rule) {
  if (rule.scope === 'connection') return [rule.scope, rule.connectorId];
  if (rule.scope === 'server') return [rule.scope, rule.connectorId, rule.serverName];
  return [rule.scope, rule.connectorId, rule.serverName, rule.toolName];
}

export function governanceRuleId(rule) {
  return targetParts(rule).map((part) => encodeURIComponent(part)).join(':');
}

export function normalizeGovernanceMutation(input) {
  const scope = requiredText(input?.scope, 'scope');
  if (!GOVERNANCE_SCOPES.includes(scope)) throw new Error(`Unsupported policy layer: ${scope}`);
  const effect = requiredText(input?.effect, 'effect');
  if (![...GOVERNANCE_EFFECTS, 'inherit'].includes(effect)) throw new Error(`Unsupported policy effect: ${effect}`);
  const connectorId = requiredText(input?.connectorId, 'connectorId');
  const normalized = { scope, effect, connectorId };
  if (scope === 'server' || scope === 'tool') normalized.serverName = requiredText(input?.serverName, 'serverName');
  if (scope === 'tool') {
    normalized.toolName = requiredText(input?.toolName, 'toolName');
    normalized.publicName = typeof input?.publicName === 'string' && input.publicName.trim()
      ? input.publicName.trim()
      : publicToolName(normalized.serverName, normalized.toolName);
  }
  return normalized;
}

export function normalizeGovernanceRule(input) {
  const rule = normalizeGovernanceMutation(input);
  if (rule.effect === 'inherit') throw new Error('A persisted rule cannot use inherit');
  return { ...rule, id: governanceRuleId(rule) };
}

function normalizeRuleList(input) {
  const byId = new Map();
  for (const raw of Array.isArray(input) ? input : []) {
    try {
      const rule = normalizeGovernanceRule(raw);
      byId.set(rule.id, rule);
    } catch {
      // A corrupted or future-version rule fails closed into "not in effect", so unrelated tools are never disabled by mistake.
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function normalizeGovernanceDocument(input) {
  const revision = Number.isInteger(input?.revision) && input.revision >= 0 ? input.revision : 0;
  const history = [];
  for (const item of Array.isArray(input?.history) ? input.history : []) {
    if (!Number.isInteger(item?.revision) || item.revision < 0) continue;
    history.push({
      revision: item.revision,
      createdAt: Number.isFinite(item.createdAt) ? item.createdAt : 0,
      rules: normalizeRuleList(item.rules),
    });
  }
  return {
    key: 'active',
    version: 1,
    revision,
    updatedAt: Number.isFinite(input?.updatedAt) ? input.updatedAt : 0,
    rules: normalizeRuleList(input?.rules),
    history: history.slice(-GOVERNANCE_HISTORY_LIMIT),
  };
}

export function mutateGovernanceRules(rules, input) {
  const mutation = normalizeGovernanceMutation(input);
  const targetId = governanceRuleId(mutation);
  const next = normalizeRuleList(rules).filter((rule) => rule.id !== targetId);
  if (mutation.effect !== 'inherit') next.push(normalizeGovernanceRule(mutation));
  next.sort((a, b) => a.id.localeCompare(b.id));
  return next;
}

function matchingRule(rules, scope, target) {
  return rules.find((rule) => (
    rule.scope === scope
    && rule.connectorId === target.connectorId
    && (scope === 'connection' || rule.serverName === target.serverName)
    && (scope !== 'tool' || (
      target.toolName
        ? rule.toolName === target.toolName
        : target.publicName && (rule.publicName || publicToolName(rule.serverName, rule.toolName)) === target.publicName
    ))
  ));
}

export function resolveGovernancePolicy(target, inputRules) {
  if (target.connectionEnabled === false) {
    return { effect: 'deny', source: 'lifecycle', sourceLabel: SOURCE_LABELS.lifecycle, ruleId: null };
  }
  const rules = normalizeRuleList(inputRules);
  for (const scope of ['tool', 'server', 'connection']) {
    const rule = matchingRule(rules, scope, target);
    if (rule) return { effect: rule.effect, source: scope, sourceLabel: SOURCE_LABELS[scope], ruleId: rule.id };
  }
  return { effect: 'allow', source: 'default', sourceLabel: SOURCE_LABELS.default, ruleId: null };
}

export function inspectGovernanceRules(rules, records, inventories = new Map()) {
  return normalizeRuleList(rules).map((rule) => {
    const matchingRecords = records.filter((record) => (
      record.connectorId === rule.connectorId
      && (rule.scope === 'connection' || record.serverName === rule.serverName)
    ));
    let status = matchingRecords.length > 0 ? 'active' : 'orphaned';
    if (rule.scope === 'tool' && matchingRecords.length > 0) {
      const inventory = inventories.get(rule.serverName);
      if (!inventory?.observed) status = 'unobserved';
      else if (!inventory.tools.has(rule.toolName)) status = 'stale';
    }
    return {
      ...rule,
      status,
      statusLabel: status === 'active'
        ? 'In effect'
        : status === 'stale'
          ? 'The tool is gone or was renamed'
          : status === 'orphaned'
            ? 'The target connection does not exist'
            : 'No tool inventory has been observed yet',
    };
  });
}

export class GovernancePolicyService {
  constructor(store, { now = () => Date.now(), historyLimit = GOVERNANCE_HISTORY_LIMIT } = {}) {
    this.store = store;
    this.now = now;
    this.historyLimit = historyLimit;
    this.document = normalizeGovernanceDocument(null);
  }

  async load() {
    this.document = normalizeGovernanceDocument(await this.store.get().catch(() => null));
    return this.snapshot();
  }

  snapshot() {
    return {
      ...this.document,
      rules: cloneRules(this.document.rules),
      history: this.document.history.map((item) => ({ ...item, rules: cloneRules(item.rules) })),
    };
  }

  preview(input) {
    const mutation = normalizeGovernanceMutation(input);
    const rules = mutateGovernanceRules(this.document.rules, mutation);
    return {
      baseRevision: this.document.revision,
      mutation,
      currentRules: cloneRules(this.document.rules),
      rules,
      changed: JSON.stringify(rules) !== JSON.stringify(this.document.rules),
    };
  }

  async apply(input, { expectedRevision } = {}) {
    if (expectedRevision !== undefined && expectedRevision !== this.document.revision) {
      throw new Error(`The policy has changed (current revision=${this.document.revision}); preview it again`);
    }
    const preview = this.preview(input);
    if (!preview.changed) return { changed: false, previousRevision: this.document.revision, document: this.snapshot() };
    const now = this.now();
    const previousRevision = this.document.revision;
    const history = [...this.document.history, {
      revision: previousRevision,
      createdAt: now,
      rules: cloneRules(this.document.rules),
    }].slice(-this.historyLimit);
    const nextDocument = normalizeGovernanceDocument({
      ...this.document,
      revision: previousRevision + 1,
      updatedAt: now,
      rules: preview.rules,
      history,
    });
    await this.store.put(nextDocument);
    this.document = nextDocument;
    return { changed: true, previousRevision, document: this.snapshot() };
  }

  async rollback(targetRevision, { expectedRevision } = {}) {
    if (!Number.isInteger(targetRevision) || targetRevision < 0) throw new Error('rollbackRevision must be a non-negative integer');
    if (expectedRevision !== undefined && expectedRevision !== this.document.revision) {
      throw new Error(`The policy has changed (current revision=${this.document.revision}); read it again`);
    }
    const target = targetRevision === this.document.revision
      ? { revision: targetRevision, rules: this.document.rules }
      : this.document.history.find((item) => item.revision === targetRevision);
    if (!target) throw new Error(`No rollback revision found: ${targetRevision}`);
    if (targetRevision === this.document.revision) return { changed: false, previousRevision: targetRevision, document: this.snapshot() };
    const now = this.now();
    const previousRevision = this.document.revision;
    const history = [...this.document.history, {
      revision: previousRevision,
      createdAt: now,
      rules: cloneRules(this.document.rules),
    }].slice(-this.historyLimit);
    const nextDocument = normalizeGovernanceDocument({
      ...this.document,
      revision: previousRevision + 1,
      updatedAt: now,
      rules: target.rules,
      history,
    });
    await this.store.put(nextDocument);
    this.document = nextDocument;
    return { changed: true, previousRevision, restoredRevision: targetRevision, document: this.snapshot() };
  }
}

function sameNames(left, right) {
  return left.length === right.length && left.every((name, index) => name === right[index]);
}

/**
  * Enforce the policy through the public ToolRuntime guard/restrict interfaces.
  * guard is the global final denial, while restrict narrows schema, lookup and dispatch for each Agent at the same time.
 */
export function createHostGovernanceController(ctx, { getRules, getRecords, logger } = {}) {
  let disposed = false;
  let agentsMounted = false;
  let mountedAgentCtx = null;
  let agentMountDispose = null;
  const agentRestrictions = new Map();

  const records = () => [...(getRecords?.() ?? [])];
  const rules = () => [...(getRules?.() ?? [])];

  function targetForPublicName(name) {
    if (typeof name !== 'string' || !name.startsWith('mcp__')) return null;
    const record = records()
      .filter((candidate) => name.startsWith(`mcp__${candidate.serverName}__`))
      .sort((a, b) => b.serverName.length - a.serverName.length)[0];
    if (!record) return null;
    return {
      connectorId: record.connectorId,
      serverName: record.serverName,
      publicName: name,
      connectionEnabled: record.enabled !== false,
    };
  }

  function inspect(name, overrideRules = rules()) {
    const target = targetForPublicName(name);
    return target ? { target, policy: resolveGovernancePolicy(target, overrideRules) } : null;
  }

  const disposeGuard = typeof ctx.tools?.guard === 'function'
    ? ctx.tools.guard((execution) => {
        const resolved = inspect(execution.name);
        if (resolved?.policy.effect !== 'deny') return undefined;
        return `The MCP tool ${execution.name} was denied by ${resolved.policy.sourceLabel}`;
      })
    : null;

  function observedPublicNames() {
    if (typeof ctx.tools?.schemas !== 'function') return [];
    try {
      return ctx.tools.schemas()
        .map((schema) => schema?.name)
        .filter((name) => typeof name === 'string' && targetForPublicName(name))
        .sort();
    } catch (error) {
      logger?.warn?.(`governance read Host tools failed: ${error.message}`);
      return [];
    }
  }

  function deniedObservedNames() {
    return observedPublicNames().filter((name) => inspect(name)?.policy.effect === 'deny');
  }

  function installRestriction(agent, denied) {
    const current = agentRestrictions.get(agent);
    if (current && sameNames(current.denied, denied)) return;
    if (denied.length === 0) {
      current?.dispose?.();
      agentRestrictions.delete(agent);
      return;
    }
    try {
      const dispose = agent.ctx.tools.restrict({ deny: denied });
      agentRestrictions.set(agent, { denied, dispose });
      current?.dispose?.();
    } catch (error) {
      logger?.warn?.(`governance restrict agent "${agent.id ?? 'unknown'}" failed: ${error.message}`);
    }
  }

  let syncing = false;
  function syncRestrictions() {
    if (disposed || !agentsMounted) return;
    // schemas()/restrict() may synchronously cause another tools/change while
    // Host plugins materialize lazy schemas or re-register equivalent tools.
    // JavaScript cannot interleave an unrelated external change in this stack,
    // so replaying that nested event only scans the same state again and can
    // form an endless tools/change -> schemas -> tools/change loop.
    if (syncing) return;
    syncing = true;
    try {
      const denied = deniedObservedNames();
      const live = new Set(mountedAgentCtx?.agents?.list?.() ?? []);
      for (const agent of live) installRestriction(agent, denied);
      for (const agent of agentRestrictions.keys()) {
        if (!live.has(agent)) agentRestrictions.delete(agent);
      }
    } finally {
      syncing = false;
    }
  }

  function mountAgents(agentCtx) {
    agentMountDispose?.();
    agentsMounted = true;
    mountedAgentCtx = agentCtx;
    const stopCreated = agentCtx.on?.('agent/created', syncRestrictions);
    const stopDisposed = agentCtx.on?.('agent/disposed', ({ agent }) => agentRestrictions.delete(agent));
    const stopToolsChange = agentCtx.on?.('tools/change', syncRestrictions);
    syncRestrictions();
    agentMountDispose = () => {
      agentsMounted = false;
      mountedAgentCtx = null;
      stopCreated?.();
      stopDisposed?.();
      stopToolsChange?.();
      for (const entry of agentRestrictions.values()) entry.dispose?.();
      agentRestrictions.clear();
      agentMountDispose = null;
    };
    return agentMountDispose;
  }

  return {
    inspect,
    refresh: syncRestrictions,
    mountAgents,
    capabilities() {
      return {
        executionGuard: Boolean(disposeGuard),
        visibilityRestriction: agentsMounted && typeof ctx.tools?.restrict === 'function',
        activeAgents: mountedAgentCtx?.agents?.list?.().length ?? 0,
        restrictedAgents: agentRestrictions.size,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      agentMountDispose?.();
      disposeGuard?.();
    },
  };
}
