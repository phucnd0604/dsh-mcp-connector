import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GovernancePolicyService,
  createHostGovernanceController,
  inspectGovernanceRules,
  publicToolName,
  resolveGovernancePolicy,
} from '../lib/governance.js';

function rule(scope, effect, connectorId, serverName, toolName) {
  return {
    id: [scope, connectorId, serverName, toolName].filter(Boolean).join(':'),
    scope,
    effect,
    connectorId,
    ...(serverName ? { serverName } : {}),
    ...(toolName ? { toolName } : {}),
  };
}

test('The three-layer policy resolves Tool > Server > Connection and a physical disable cannot be overridden', () => {
  const rules = [
    rule('connection', 'deny', 'acme'),
    rule('server', 'allow', 'acme', 'search'),
    rule('tool', 'deny', 'acme', 'search', 'remove'),
  ];
  assert.equal(resolveGovernancePolicy({ connectorId: 'acme', serverName: 'search', toolName: 'read' }, rules).effect, 'allow');
  assert.equal(resolveGovernancePolicy({ connectorId: 'acme', serverName: 'search', toolName: 'remove' }, rules).source, 'tool');
  assert.equal(resolveGovernancePolicy({ connectorId: 'acme', serverName: 'billing', toolName: 'read' }, rules).source, 'connection');
  assert.deepEqual(
    resolveGovernancePolicy({ connectorId: 'acme', serverName: 'search', toolName: 'read', connectionEnabled: false }, rules),
    { effect: 'deny', source: 'lifecycle', sourceLabel: 'Connection disabled', ruleId: null },
  );
});

test('The MCP public tool name matches the normalization and hash contract published by the Host', () => {
  assert.equal(publicToolName('acme', 'search'), 'mcp__acme__search');
  assert.equal(publicToolName('acme', '搜索 公司'), 'mcp__acme________4222021ed6dd');
  const long = publicToolName('acme', 'x'.repeat(80));
  assert.equal(long.length, 64);
  assert.match(long, /^mcp__acme__x+_[a-f0-9]{12}$/);
});

test('A policy change can be previewed, committed by revision and rolled back, and survives a restart', async () => {
  let persisted;
  const store = {
    async get() { return persisted; },
    async put(value) { persisted = structuredClone(value); },
  };
  let now = 1000;
  const service = new GovernancePolicyService(store, { now: () => ++now });
  await service.load();
  const mutation = { scope: 'tool', effect: 'deny', connectorId: 'acme', serverName: 'search', toolName: 'remove' };
  const preview = service.preview(mutation);
  assert.equal(preview.baseRevision, 0);
  assert.equal(preview.changed, true);
  assert.equal(service.snapshot().rules.length, 0, 'preview does not write state');

  const applied = await service.apply(mutation, { expectedRevision: 0 });
  assert.equal(applied.document.revision, 1);
  assert.equal(applied.document.rules[0].effect, 'deny');
  await assert.rejects(service.apply({ ...mutation, effect: 'allow' }, { expectedRevision: 0 }), /preview it again/);

  const restarted = new GovernancePolicyService(store);
  await restarted.load();
  assert.equal(restarted.snapshot().revision, 1);
  assert.equal(restarted.snapshot().rules.length, 1);
  const rolledBack = await restarted.rollback(0, { expectedRevision: 1 });
  assert.equal(rolledBack.document.revision, 2);
  assert.deepEqual(rolledBack.document.rules, []);
});

test('A governance persistence failure changes neither the in-memory rules nor the execution result', async () => {
  const service = new GovernancePolicyService({
    async get() { return null; },
    async put() { throw new Error('disk full'); },
  });
  await service.load();
  await assert.rejects(service.apply({
    scope: 'connection', effect: 'deny', connectorId: 'acme',
  }, { expectedRevision: 0 }), /disk full/);
  assert.equal(service.snapshot().revision, 0);
  assert.deepEqual(service.snapshot().rules, []);
});

test('A deleted or renamed tool only marks the old rule stale and never hits the new tool', () => {
  const rules = [rule('tool', 'deny', 'acme', 'search', 'old_name')];
  const records = [{ connectorId: 'acme', serverName: 'search', enabled: true }];
  const unknown = inspectGovernanceRules(rules, records, new Map());
  assert.equal(unknown[0].status, 'unobserved');

  const inventories = new Map([['search', { observed: true, tools: new Set(['new_name']) }]]);
  const stale = inspectGovernanceRules(rules, records, inventories);
  assert.equal(stale[0].status, 'stale');
  assert.equal(resolveGovernancePolicy({ connectorId: 'acme', serverName: 'search', toolName: 'new_name' }, rules).effect, 'allow');
});

function governanceHost(initialNames, initialAgents = [], { emitFromSchemas = false } = {}) {
  let names = [...initialNames];
  let schemaReads = 0;
  const guards = new Set();
  const listeners = new Map();
  const agents = [...initialAgents];
  const emit = (event, payload = {}) => {
    for (const listener of listeners.get(event) ?? []) listener(payload);
  };
  const tools = {
    schemas() {
      schemaReads += 1;
      if (emitFromSchemas) emit('tools/change');
      return names.map((name) => ({ name, description: '', parameters: {} }));
    },
    guard(fn) { guards.add(fn); return () => guards.delete(fn); },
    restrict() {},
  };
  const agentCtx = {
    agents: { list: () => [...agents] },
    on(event, listener) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(listener);
      return () => listeners.get(event).delete(listener);
    },
  };
  function makeAgent(id) {
    const restrictions = new Set();
    const agent = {
      id,
      restrictions,
      ctx: {
        tools: {
          restrict({ deny }) {
            const current = new Set(deny);
            restrictions.add(current);
            emit('tools/change');
            return () => {
              restrictions.delete(current);
              emit('tools/change');
            };
          },
        },
      },
    };
    return agent;
  }
  return {
    ctx: { tools }, agentCtx, agents, guards, emit, makeAgent,
    setNames(next) { names = [...next]; emit('tools/change'); },
    denied(agent) { return new Set([...agent.restrictions].flatMap((set) => [...set])); },
    schemaReads: () => schemaReads,
  };
}

test('The Host controller really narrows the Agent schema across Servers and denies execution with guard; new tools inherit the policy', () => {
  const s1Read = publicToolName('search', 'read');
  const s1Write = publicToolName('search', 'write');
  const s2List = publicToolName('billing', 'list');
  const host = governanceHost([s1Read, s1Write, s2List, 'unrelated']);
  const firstAgent = host.makeAgent('a1');
  host.agents.push(firstAgent);
  const records = [
    { connectorId: 'acme', serverName: 'search', enabled: true },
    { connectorId: 'acme', serverName: 'billing', enabled: true },
  ];
  let rules = [rule('connection', 'deny', 'acme'), rule('tool', 'allow', 'acme', 'search', 'read')];
  const controller = createHostGovernanceController(host.ctx, { getRules: () => rules, getRecords: () => records });
  controller.mountAgents(host.agentCtx);

  assert.deepEqual([...host.denied(firstAgent)].sort(), [s1Write, s2List].sort());
  const guard = [...host.guards][0];
  assert.equal(guard({ name: s1Read }), undefined);
  assert.match(guard({ name: s1Write }), /was denied by Connection policy/);
  assert.equal(guard({ name: 'unrelated' }), undefined);

  rules = [...rules, rule('server', 'allow', 'acme', 'billing')];
  controller.refresh();
  assert.deepEqual([...host.denied(firstAgent)], [s1Write]);

  const s1Delete = publicToolName('search', 'delete');
  host.setNames([s1Read, s1Write, s1Delete, s2List, 'unrelated']);
  assert.deepEqual([...host.denied(firstAgent)].sort(), [s1Delete, s1Write].sort());

  const secondAgent = host.makeAgent('a2');
  host.agents.push(secondAgent);
  host.emit('agent/created', { agent: secondAgent });
  assert.deepEqual([...host.denied(secondAgent)].sort(), [s1Delete, s1Write].sort());

  controller.dispose();
  assert.equal(host.guards.size, 0);
  assert.equal(firstAgent.restrictions.size, 0);
  assert.equal(secondAgent.restrictions.size, 0);
});

test('Governance sync ignores nested tools/change triggered by schemas and restrict so it does not rescan forever', () => {
  const deniedTool = publicToolName('search', 'write');
  const host = governanceHost([deniedTool], [], { emitFromSchemas: true });
  const agent = host.makeAgent('nested-change');
  host.agents.push(agent);
  const controller = createHostGovernanceController(host.ctx, {
    getRules: () => [rule('connection', 'deny', 'acme')],
    getRecords: () => [{ connectorId: 'acme', serverName: 'search', enabled: true }],
  });

  controller.mountAgents(host.agentCtx);
  assert.equal(host.schemaReads(), 1);
  assert.deepEqual([...host.denied(agent)], [deniedTool]);

  host.emit('tools/change');
  assert.equal(host.schemaReads(), 2, 'an independent later change should still trigger exactly one sync');
  controller.dispose();
});
