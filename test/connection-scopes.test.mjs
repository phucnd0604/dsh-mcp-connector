import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ConnectionScopeService,
  bindingForConnection,
  connectionVisibleInWorkspace,
  createHostScopeController,
  mutateScopeBinding,
  normalizeScopeDocument,
  normalizeScopeTarget,
} from '../lib/connection-scopes.js';

test('A legacy connection without an explicit binding keeps profile/global compatibility', () => {
  const document = normalizeScopeDocument(null);
  assert.deepEqual(bindingForConnection(document.bindings, 'legacy'), {
    connectionKey: 'legacy', global: true, projects: [],
  });
  assert.equal(connectionVisibleInWorkspace(bindingForConnection([], 'legacy'), 'workspace-a'), true);
});

test('A corrupt or unreadable existing scope document fails closed and never degrades to global', async () => {
  assert.throws(() => normalizeScopeDocument({
    revision: 1,
    bindings: [{ connectionKey: 'project-only', global: false, projects: [] }],
  }), /needs at least one scope/);
  const service = new ConnectionScopeService({
    async get() { throw new Error('scope storage unreadable'); },
  });
  await assert.rejects(service.load(), /scope storage unreadable/);
});

test('A project target requires a stable workspaceId while global carries no project identifier', () => {
  assert.deepEqual(normalizeScopeTarget({ scope: 'global', workspaceId: 'ignored' }), { scope: 'global' });
  assert.deepEqual(normalizeScopeTarget({ scope: 'project', workspaceId: ' workspace-a ' }), {
    scope: 'project', workspaceId: 'workspace-a',
  });
  assert.throws(() => normalizeScopeTarget({ scope: 'project' }), /workspaceId/);
});

test('copy only adds a scope binding while move replaces it and never touches the connection config', () => {
  const project = mutateScopeBinding(
    { connectionKey: 'acme', global: false, projects: ['workspace-a'] },
    { mode: 'copy', target: { scope: 'project', workspaceId: 'workspace-b' } },
  );
  assert.deepEqual(project, { connectionKey: 'acme', global: false, projects: ['workspace-a', 'workspace-b'] });
  const promoted = mutateScopeBinding(project, { mode: 'move', target: { scope: 'global' } });
  assert.deepEqual(promoted, { connectionKey: 'acme', global: true, projects: [] });
});

test('A scope change is previewed, committed by revision, restored from storage and rolled back', async () => {
  let persisted;
  const store = {
    async get() { return persisted; },
    async put(value) { persisted = structuredClone(value); },
  };
  let now = 100;
  const service = new ConnectionScopeService(store, { now: () => ++now });
  await service.load();
  const input = {
    connectionKey: 'acme', mode: 'move', target: { scope: 'project', workspaceId: 'workspace-a' },
  };
  const preview = service.preview(input);
  assert.equal(preview.baseRevision, 0);
  assert.deepEqual(preview.current, { connectionKey: 'acme', global: true, projects: [] });
  assert.deepEqual(preview.next, { connectionKey: 'acme', global: false, projects: ['workspace-a'] });
  assert.equal(service.snapshot().bindings.length, 0, 'preview does not write storage');

  const applied = await service.apply(input, { expectedRevision: 0 });
  assert.equal(applied.document.revision, 1);
  assert.equal(connectionVisibleInWorkspace(service.binding('acme'), 'workspace-a'), true);
  assert.equal(connectionVisibleInWorkspace(service.binding('acme'), 'workspace-b'), false);
  await assert.rejects(service.apply({ ...input, target: { scope: 'global' } }, { expectedRevision: 0 }), /preview it again/);

  const restarted = new ConnectionScopeService(store);
  await restarted.load();
  assert.deepEqual(restarted.binding('acme').projects, ['workspace-a']);
  const rolledBack = await restarted.rollback(0, { expectedRevision: 1 });
  assert.equal(rolledBack.document.revision, 2);
  assert.deepEqual(restarted.binding('acme'), { connectionKey: 'acme', global: true, projects: [] });
});

test('A scope persistence failure changes no memory and produces no credential copy', async () => {
  const service = new ConnectionScopeService({
    async get() { return null; },
    async put() { throw new Error('disk full'); },
  });
  await service.load();
  await assert.rejects(service.assign('secret-connection', { scope: 'project', workspaceId: 'workspace-a' }), /disk full/);
  assert.equal(service.snapshot().revision, 0);
  assert.deepEqual(service.snapshot().bindings, []);
});

function scopeHost(names, { emitFromSchemas = false } = {}) {
  const guards = new Set();
  const listeners = new Map();
  const agents = [];
  let schemaReads = 0;
  const emit = (event, payload = {}) => {
    for (const listener of listeners.get(event) ?? []) listener(payload);
  };
  const ctx = {
    tools: {
      schemas: () => {
        schemaReads += 1;
        if (emitFromSchemas) emit('tools/change');
        return names.map((name) => ({ name }));
      },
      guard(fn) { guards.add(fn); return () => guards.delete(fn); },
      restrict() {},
    },
  };
  const agentCtx = {
    agents: { list: () => agents },
    on(event, listener) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(listener);
      return () => listeners.get(event).delete(listener);
    },
  };
  function agent(id, workspaceId) {
    const restrictions = new Set();
    const value = {
      id,
      workspaceId,
      restrictions,
      ctx: { tools: { restrict({ deny }) {
        const entry = new Set(deny);
        restrictions.add(entry);
        return () => restrictions.delete(entry);
      } } },
    };
    agents.push(value);
    return value;
  }
  return {
    ctx, agentCtx, agents, guards, agent,
    denied(value) { return new Set([...value.restrictions].flatMap((entry) => [...entry])); },
    emit,
    schemaReads: () => schemaReads,
  };
}

test('The Host narrows visibility for project-only tools and fails closed at the execution layer', () => {
  const globalTool = 'mcp__global-server__read';
  const projectTool = 'mcp__project-server__read';
  const host = scopeHost([globalTool, projectTool, 'unrelated']);
  const inProject = host.agent('a', 'workspace-a');
  const outside = host.agent('b', 'workspace-b');
  const records = [
    { key: 'global', serverName: 'global-server' },
    { key: 'project', serverName: 'project-server' },
  ];
  const bindings = [{ connectionKey: 'project', global: false, projects: ['workspace-a'] }];
  const controller = createHostScopeController(host.ctx, {
    getRecords: () => records,
    getBindings: () => bindings,
    workspaceIdForAgent: (agent) => agent.workspaceId,
  });
  controller.mountAgents(host.agentCtx);

  assert.deepEqual([...host.denied(inProject)], []);
  assert.deepEqual([...host.denied(outside)], [projectTool]);
  const guard = [...host.guards][0];
  assert.equal(guard({ name: projectTool, agent: inProject }), undefined);
  assert.match(guard({ name: projectTool, agent: outside }), /does not belong to the current workspace/);
  assert.match(guard({ name: projectTool }), /does not belong to the current workspace/, 'a project call without an Agent must fail closed');
  assert.equal(guard({ name: globalTool }), undefined);
  assert.equal(guard({ name: 'unrelated' }), undefined);

  controller.dispose();
  assert.equal(host.guards.size, 0);
  assert.equal(outside.restrictions.size, 0);
});

test('Scope sync ignores nested tools/change triggered by schemas and later independent changes still apply', () => {
  const projectTool = 'mcp__project-server__read';
  const host = scopeHost([projectTool], { emitFromSchemas: true });
  const outside = host.agent('outside', 'workspace-b');
  const controller = createHostScopeController(host.ctx, {
    getRecords: () => [{ key: 'project', serverName: 'project-server' }],
    getBindings: () => [{ connectionKey: 'project', global: false, projects: ['workspace-a'] }],
    workspaceIdForAgent: (agent) => agent.workspaceId,
  });

  controller.mountAgents(host.agentCtx);
  assert.equal(host.schemaReads(), 1);
  assert.deepEqual([...host.denied(outside)], [projectTool]);

  host.emit('tools/change');
  assert.equal(host.schemaReads(), 2);
  controller.dispose();
});
