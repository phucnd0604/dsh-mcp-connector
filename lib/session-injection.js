/**
 * Per-Agent MCP tool visibility.
 *
 * Connections remain provisioned; this controller only narrows the Host tool
 * view and dispatch boundary for records explicitly configured as `session`.
 * State is memory-only and keyed by the live Agent object, so it cannot leak to
 * another conversation or survive a DSH restart.
 */

export const INJECTION_MODES = ['always', 'session'];
export const DEFAULT_SESSION_TOOL_TTL_MINUTES = 30;
export const MAX_SESSION_TOOL_TTL_MINUTES = 30;

export function normalizeInjectionMode(value) {
  if (value === undefined || value === null || value === '') return 'always';
  if (!INJECTION_MODES.includes(value)) throw new Error(`Unsupported tool injection mode: ${value}`);
  return value;
}

function normalizeTtlMinutes(value) {
  if (value === undefined || value === null) return DEFAULT_SESSION_TOOL_TTL_MINUTES;
  const ttl = Number(value);
  if (!Number.isFinite(ttl) || ttl < 1 || ttl > MAX_SESSION_TOOL_TTL_MINUTES) {
    throw new Error(`ttlMinutes must be between 1 and ${MAX_SESSION_TOOL_TTL_MINUTES}`);
  }
  return ttl;
}

function uniqueNames(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim()))].sort();
}

function sameNames(left, right) {
  return left.length === right.length && left.every((name, index) => name === right[index]);
}

function agentLabel(agent) {
  return String(agent?.id ?? 'unknown');
}

/** Host-enforced, memory-only session visibility for MCP business tools. */
export function createSessionToolInjectionController(ctx, {
  getRecords,
  workspaceIdForAgent,
  isRecordVisible = () => true,
  isToolAllowed = () => true,
  now = () => Date.now(),
  logger,
} = {}) {
  let disposed = false;
  let agentsMounted = false;
  let mountedAgentCtx = null;
  let agentMountDispose = null;
  let expiryTimer = null;
  let syncing = false;
  const restrictions = new Map();
  const states = new Map();

  const records = () => [...(getRecords?.() ?? [])];

  function recordForPublicName(name) {
    if (typeof name !== 'string' || !name.startsWith('mcp__')) return null;
    return records()
      .filter((record) => name.startsWith(`mcp__${record.serverName}__`))
      .sort((a, b) => b.serverName.length - a.serverName.length)[0] ?? null;
  }

  function observedPublicNames() {
    if (typeof ctx.tools?.schemas !== 'function') return [];
    try {
      return ctx.tools.schemas().map((schema) => schema?.name)
        .filter((name) => typeof name === 'string' && recordForPublicName(name))
        .sort();
    } catch (error) {
      logger?.warn?.(`session injection read Host tools failed: ${error.message}`);
      return [];
    }
  }

  function stateFor(agent, create = false) {
    let state = states.get(agent);
    if (!state && create) {
      state = { revision: 0, activations: new Map() };
      states.set(agent, state);
    }
    return state;
  }

  function activationValid(agent, publicName, at = now()) {
    const activation = stateFor(agent)?.activations.get(publicName);
    return Boolean(activation && activation.expiresAt > at);
  }

  function purgeState(agent, observedSet, at = now()) {
    const state = stateFor(agent);
    if (!state) return false;
    let changed = false;
    for (const [publicName, activation] of state.activations) {
      const record = recordForPublicName(publicName);
      if (activation.expiresAt <= at
          || (observedSet && !observedSet.has(publicName))
          || !record
          || record.key !== activation.connectionKey
          || record.enabled === false
          || normalizeInjectionMode(record.injectionMode) !== 'session') {
        state.activations.delete(publicName);
        changed = true;
      }
    }
    if (changed) state.revision += 1;
    if (state.activations.size === 0 && state.revision === 0) states.delete(agent);
    return changed;
  }

  function scheduleExpiry() {
    clearTimeout(expiryTimer);
    expiryTimer = null;
    if (disposed) return;
    let nextExpiry = Number.POSITIVE_INFINITY;
    for (const state of states.values()) {
      for (const activation of state.activations.values()) nextExpiry = Math.min(nextExpiry, activation.expiresAt);
    }
    if (!Number.isFinite(nextExpiry)) return;
    expiryTimer = setTimeout(() => {
      expiryTimer = null;
      refresh();
    }, Math.max(0, nextExpiry - now()) + 1);
    expiryTimer.unref?.();
  }

  function deniedNames(agent, observed) {
    const at = now();
    return observed.filter((name) => {
      const record = recordForPublicName(name);
      return record
        && record.enabled !== false
        && normalizeInjectionMode(record.injectionMode) === 'session'
        && !activationValid(agent, name, at);
    });
  }

  function installRestriction(agent, denied) {
    const current = restrictions.get(agent);
    if (current && sameNames(current.denied, denied)) return;
    if (denied.length === 0) {
      current?.dispose?.();
      restrictions.delete(agent);
      return;
    }
    try {
      // Install the new, equally-or-more-current restriction before releasing
      // the prior layer. This keeps schema/lookup/dispatch fail closed while
      // tools/change is racing with an activation update.
      const dispose = agent.ctx.tools.restrict({ deny: denied });
      restrictions.set(agent, { denied, dispose });
      current?.dispose?.();
    } catch (error) {
      logger?.warn?.(`session injection restrict agent "${agentLabel(agent)}" failed: ${error.message}`);
    }
  }

  function refresh() {
    if (disposed || !agentsMounted || syncing) return;
    syncing = true;
    try {
      const observed = observedPublicNames();
      const observedSet = new Set(observed);
      const live = new Set(mountedAgentCtx?.agents?.list?.() ?? []);
      for (const agent of live) {
        purgeState(agent, observedSet);
        installRestriction(agent, deniedNames(agent, observed));
      }
      for (const agent of [...restrictions.keys()]) {
        if (!live.has(agent)) {
          restrictions.get(agent)?.dispose?.();
          restrictions.delete(agent);
        }
      }
      for (const agent of [...states.keys()]) if (!live.has(agent)) states.delete(agent);
      scheduleExpiry();
    } finally {
      syncing = false;
    }
  }

  const disposeGuard = typeof ctx.tools?.guard === 'function'
    ? ctx.tools.guard((execution) => {
        const record = recordForPublicName(execution.name);
        if (!record || normalizeInjectionMode(record.injectionMode) !== 'session') return undefined;
        if (record.enabled === false) return `The connection owning the MCP tool ${execution.name} is disabled`;
        if (!execution.agent) return `The MCP tool ${execution.name} must be explicitly activated in the current session`;
        if (!isRecordVisible(record, execution.agent)) return `The MCP tool ${execution.name} does not belong to the current workspace`;
        if (!isToolAllowed(execution.name, record)) return `The MCP tool ${execution.name} is denied by the governance policy`;
        if (!activationValid(execution.agent, execution.name)) return `The MCP tool ${execution.name} is not activated in the current session, or the activation has expired`;
        return undefined;
      })
    : null;

  function assertSessionCapabilities() {
    const current = capabilities();
    if (!current.executionGuard || !current.visibilityRestriction) {
      throw new Error('The current DSH Host does not support both tools.guard and Agent tools.restrict, so per-session injection cannot be used safely');
    }
  }

  function assertAgent(agent) {
    if (!agent) throw new Error('The Agent session context is missing');
  }

  function activationPlan(agent, input = {}) {
    assertAgent(agent);
    assertSessionCapabilities();
    const connectionKey = typeof input.connectionKey === 'string' ? input.connectionKey.trim() : '';
    if (!connectionKey) throw new Error('connectionKey is required');
    const record = records().find((candidate) => candidate.key === connectionKey);
    if (!record) throw new Error(`Connection "${connectionKey}" does not exist`);
    if (record.enabled === false) throw new Error(`Connection "${record.name}" is disabled`);
    if (normalizeInjectionMode(record.injectionMode) !== 'session') {
      throw new Error(`Connection "${record.name}" is not set to "Enable per session"`);
    }
    if (!isRecordVisible(record, agent)) throw new Error(`Connection "${record.name}" does not belong to the current workspace`);
    const requested = uniqueNames(input.publicNames);
    if (requested.length === 0) throw new Error('At least one exact public tool name is required');
    const observed = new Set(observedPublicNames());
    for (const publicName of requested) {
      if (!observed.has(publicName)) throw new Error(`The Host has not observed the tool "${publicName}" yet`);
      const owner = recordForPublicName(publicName);
      if (!owner || owner.key !== record.key) throw new Error(`The tool "${publicName}" does not belong to the connection "${record.name}"`);
      if (!isToolAllowed(publicName, record)) throw new Error(`The tool "${publicName}" is denied by the governance policy`);
    }
    const ttlMinutes = normalizeTtlMinutes(input.ttlMinutes);
    const state = stateFor(agent);
    return {
      baseRevision: state?.revision ?? 0,
      connectionKey: record.key,
      connectionName: record.name,
      serverName: record.serverName,
      publicNames: requested,
      newPublicNames: requested.filter((name) => !activationValid(agent, name)),
      ttlMinutes,
      expiresAt: now() + ttlMinutes * 60_000,
      risk: 'unclassified',
      requiresConfirmation: true,
      nextInferenceBoundary: true,
    };
  }

  function status(agent) {
    assertAgent(agent);
    const observed = new Set(observedPublicNames());
    purgeState(agent, observed);
    const state = stateFor(agent);
    const active = [...(state?.activations ?? new Map()).entries()].map(([publicName, activation]) => ({
      publicName,
      connectionKey: activation.connectionKey,
      source: activation.source,
      activatedAt: activation.activatedAt,
      expiresAt: activation.expiresAt,
    })).sort((a, b) => a.publicName.localeCompare(b.publicName));
    const hiddenCount = deniedNames(agent, [...observed]).length;
    scheduleExpiry();
    return {
      agentId: agentLabel(agent),
      workspaceId: workspaceIdForAgent?.(agent) ?? null,
      revision: state?.revision ?? 0,
      active,
      activeCount: active.length,
      hiddenCount,
      capabilities: capabilities(),
      persisted: false,
    };
  }

  function previewActivation(agent, input) {
    return activationPlan(agent, input);
  }

  function activate(agent, input = {}) {
    if (input.confirmed !== true) throw new Error('The activation must come from an explicit user confirmation');
    const plan = activationPlan(agent, input);
    const state = stateFor(agent, true);
    if (!Number.isInteger(input.expectedRevision) || input.expectedRevision !== state.revision) {
      throw new Error(`The session tool state has changed (current revision=${state.revision}), please preview again`);
    }
    const activatedAt = now();
    const expiresAt = activatedAt + plan.ttlMinutes * 60_000;
    for (const publicName of plan.publicNames) {
      state.activations.set(publicName, {
        connectionKey: plan.connectionKey,
        source: 'user-confirmed',
        activatedAt,
        expiresAt,
      });
    }
    state.revision += 1;
    refresh();
    return { ...status(agent), activated: plan.publicNames, nextInferenceBoundary: true };
  }

  function deactivate(agent, input = {}) {
    assertAgent(agent);
    const state = stateFor(agent, true);
    if (!Number.isInteger(input.expectedRevision) || input.expectedRevision !== state.revision) {
      throw new Error(`The session tool state has changed (current revision=${state.revision}), please read it again`);
    }
    const requested = uniqueNames(input.publicNames);
    const connectionKey = typeof input.connectionKey === 'string' ? input.connectionKey.trim() : '';
    let changed = false;
    for (const [publicName, activation] of [...state.activations]) {
      const remove = requested.length > 0
        ? requested.includes(publicName)
        : connectionKey ? activation.connectionKey === connectionKey : true;
      if (remove) {
        state.activations.delete(publicName);
        changed = true;
      }
    }
    if (changed) state.revision += 1;
    refresh();
    return { ...status(agent), changed };
  }

  function forgetConnection(connectionKey) {
    let changed = false;
    for (const state of states.values()) {
      let stateChanged = false;
      for (const [publicName, activation] of [...state.activations]) {
        if (activation.connectionKey === connectionKey) {
          state.activations.delete(publicName);
          stateChanged = true;
        }
      }
      if (stateChanged) {
        state.revision += 1;
        changed = true;
      }
    }
    if (changed) refresh();
    return changed;
  }

  function disposeAgent(agent) {
    restrictions.get(agent)?.dispose?.();
    restrictions.delete(agent);
    states.delete(agent);
    scheduleExpiry();
  }

  function mountAgents(agentCtx) {
    agentMountDispose?.();
    agentsMounted = true;
    mountedAgentCtx = agentCtx;
    const stopCreated = agentCtx.on?.('agent/created', refresh);
    const stopDisposed = agentCtx.on?.('agent/disposed', ({ agent }) => disposeAgent(agent));
    const stopToolsChange = agentCtx.on?.('tools/change', refresh);
    refresh();
    agentMountDispose = () => {
      agentsMounted = false;
      mountedAgentCtx = null;
      stopCreated?.();
      stopDisposed?.();
      stopToolsChange?.();
      for (const entry of restrictions.values()) entry.dispose?.();
      restrictions.clear();
      states.clear();
      clearTimeout(expiryTimer);
      expiryTimer = null;
      agentMountDispose = null;
    };
    return agentMountDispose;
  }

  function capabilities() {
    return {
      executionGuard: Boolean(disposeGuard),
      visibilityRestriction: agentsMounted && typeof ctx.tools?.restrict === 'function',
      activeAgents: mountedAgentCtx?.agents?.list?.().length ?? 0,
      restrictedAgents: restrictions.size,
      maxTtlMinutes: MAX_SESSION_TOOL_TTL_MINUTES,
      statePersistence: 'memory-only',
    };
  }

  return {
    refresh,
    mountAgents,
    capabilities,
    status,
    previewActivation,
    activate,
    deactivate,
    forgetConnection,
    inspect(name, agent) {
      const record = recordForPublicName(name);
      if (!record) return null;
      return {
        record,
        injectionMode: normalizeInjectionMode(record.injectionMode),
        active: Boolean(agent && activationValid(agent, name)),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      agentMountDispose?.();
      clearTimeout(expiryTimer);
      disposeGuard?.();
    },
  };
}
