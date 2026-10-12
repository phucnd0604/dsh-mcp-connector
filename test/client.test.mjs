import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

async function loadClient({
  clientDocument,
  reactApi = {},
  reactDomApi = { createPortal() {} },
  jsxRuntime = { jsx() {}, jsxs() {} },
  windowExtras = {},
  sourceTransform = (source) => source,
} = {}) {
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  let plugin;
  const document = clientDocument ?? {
    querySelector: () => null,
    createElement: () => ({ dataset: {}, remove() {} }),
    head: { append() {} },
  };
  const window = {
    ...windowExtras,
    __ModuleLoader__: {
      load(definition) {
        plugin = definition.factory((id) => {
          if (id === 'react/jsx-runtime') return jsxRuntime;
          if (id === 'react') return reactApi;
          if (id === 'react-dom') return reactDomApi;
          throw new Error(`unexpected client import: ${id}`);
        });
      },
    },
  };
  Function('window', 'document', sourceTransform(source))(window, document);
  return plugin;
}

function clientContext({
  workspaceId = 'workspace-1',
  workspaceItems,
  recentWorkspaceId = workspaceId ?? undefined,
  settingsScope,
  workspaceNavigation = 'legacy',
  nativeSidebar = false,
  layout,
} = {}) {
  const registrations = new Map();
  const registrationOrder = [];
  const injectors = new Map();
  const declaredSlots = new Set([
    'shell.overlay',
    'sidebar.footer.action',
    'settings.plugin.item',
    ...(nativeSidebar ? ['main', 'sidebar.panellist'] : []),
  ]);
  const calls = [];
  const shell = {
    setDraft(prompt) {
      calls.push(['setDraft', prompt]);
    },
  };
  const workspaces = {
    list: {
      getSnapshot: () => ({
        items: workspaceItems ?? (workspaceId == null ? [] : [{ workspaceId, sessionIds: ['session-current'] }]),
        recentWorkspaceId,
      }),
    },
  };
  if (workspaceNavigation === 'legacy' || workspaceNavigation === 'both') {
    workspaces.connectWorkspace = async (id) => {
      calls.push(['connectWorkspace', id]);
      return 'session-new';
    };
  }
  const sessions = {
    list: { getSnapshot: () => ({ current: workspaceId == null ? undefined : 'session-current' }) },
    open(id) {
      calls.push(['open', id]);
    },
  };
  if (workspaceNavigation === 'sessions') {
    sessions.create = async (options) => {
      calls.push(['create', options]);
      return 'session-new';
    };
  }
  const uiWorkspace = workspaceNavigation === 'ui' || workspaceNavigation === 'both'
    ? {
        async connectWorkspace(id) {
          calls.push(['uiConnectWorkspace', id]);
          return 'session-new';
        },
      }
    : undefined;
  const ctx = {
    effect(start) {
      start();
    },
    slots: {
      inject(name, register) {
        const record = { register, cleanup: undefined };
        let records = injectors.get(name);
        if (records === undefined) injectors.set(name, records = new Set());
        records.add(record);
        if (declaredSlots.has(name)) record.cleanup = register();
        return () => {
          if (typeof record.cleanup === 'function') record.cleanup();
          records.delete(record);
        };
      },
      register(options, component) {
        const registration = { options, component };
        registrations.set(options.name, registration);
        registrationOrder.push(options.name);
        return () => {
          if (registrations.get(options.name) === registration) registrations.delete(options.name);
        };
      },
    },
    workspaces,
    sessions,
    get(service) {
      if (service === 'uiWorkspace') return uiWorkspace;
      if (service === 'conversation') return { input: { shell: () => shell } };
      if (service === 'layout') return layout;
      return undefined;
    },
  };
  if (layout !== undefined) ctx.layout = layout;
  ctx.inject = (services, callback) => {
    if (services.includes('settingsScope') && settingsScope !== undefined) {
      callback({ ...ctx, settingsScope });
    }
  };
  const slotControls = {
    declare(name) {
      if (declaredSlots.has(name)) return;
      declaredSlots.add(name);
      for (const record of injectors.get(name) ?? []) record.cleanup = record.register();
    },
    remove(name) {
      if (!declaredSlots.delete(name)) return;
      for (const record of injectors.get(name) ?? []) {
        if (typeof record.cleanup === 'function') record.cleanup();
        record.cleanup = undefined;
      }
    },
  };
  return { ctx, registrations, registrationOrder, calls, slotControls };
}

function mutableSettingsScope(initial) {
  let snapshot = initial;
  const listeners = new Set();
  const writes = [];
  const scope = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async set(field, value) {
      writes.push(['set', field, value]);
      snapshot = {
        ...snapshot,
        status: 'ready',
        value: { ...snapshot.value, [field]: value },
        user: { ...snapshot.user, [field]: value },
      };
      for (const listener of listeners) listener();
    },
    async unset(field) {
      writes.push(['unset', field]);
      const { [field]: _removed, ...user } = snapshot.user ?? {};
      snapshot = {
        ...snapshot,
        status: 'ready',
        value: { ...snapshot.value, [field]: snapshot.base?.[field] ?? true },
        user,
      };
      for (const listener of listeners) listener();
    },
    publish(next) {
      snapshot = next;
      for (const listener of listeners) listener();
    },
  };
  return { scope, writes };
}

test('the client declares the services required to start a new session', async () => {
  const plugin = await loadClient();
  assert.deepEqual(plugin.inject, ['slots', 'sessions', 'workspaces', 'conversation']);
});

test('the client entry does not depend on Host-version-specific Store, Runtime or UI Primitives modules', async () => {
  await assert.doesNotReject(() => loadClient());
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /require\("@deepseek-ai\/dsh-client-(?:store|runtime|ui-primitives|ui-settings)/);
});

test('the built-in dialog Store implements the standard snapshot, subscribe and action contract', async () => {
  const plugin = await loadClient();
  const { ctx, registrations } = clientContext();
  plugin.apply(ctx);
  const handle = registrations.get('shell.overlay').options.store;
  const instance = handle.create();
  let changes = 0;
  const unsubscribe = instance.subscribe(() => { changes += 1; });

  assert.deepEqual(instance.getSnapshot(), { open: false, detailOpen: false, sidebarVisible: true });
  instance.actions.open();
  instance.actions.detailOpened();
  assert.deepEqual(instance.getSnapshot(), { open: true, detailOpen: true, sidebarVisible: true });
  instance.actions.close();
  assert.deepEqual(instance.getSnapshot(), { open: false, detailOpen: false, sidebarVisible: true });
  assert.equal(changes, 3);
  unsubscribe();
  instance.actions.open();
  assert.equal(changes, 3);
  assert.doesNotThrow(() => instance.clearPersisted());
});

test('partial optional settings services do not block the connector UI', async () => {
  const plugin = await loadClient();
  for (const settingsScope of [null, {}, { bind: false },
    { bind: () => undefined }, { bind: () => ({}) },
    { bind: () => ({ getSnapshot() {} }) },
    { bind: () => ({ subscribe() {} }) }]) {
    const { ctx, registrations } = clientContext({ settingsScope });
    assert.doesNotThrow(() => plugin.apply(ctx));
    const overlay = registrations.get('shell.overlay');
    assert.ok(overlay, 'connector overlay must remain available');
    assert.equal(overlay.options.store.create().getSnapshot().sidebarVisible, true);
    assert.equal(registrations.has('settings.plugin.item'), false);
  }
});

test('the settings scope controls sidebar visibility and registers a shortcut entry for the same dialog', async () => {
  const plugin = await loadClient();
  const settings = mutableSettingsScope({
    status: 'ready',
    value: { showSidebarEntry: false },
    base: { showSidebarEntry: true },
    user: { showSidebarEntry: false },
    writable: true,
    mode: 'host',
    revision: 1,
  });
  let bindSpec;
  const { ctx, registrations } = clientContext({
    settingsScope: {
      bind(spec) {
        bindSpec = spec;
        return settings.scope;
      },
    },
  });

  plugin.apply(ctx);

  assert.equal(bindSpec.namespace, 'mcp-connector');
  assert.deepEqual(bindSpec.decode({ showSidebarEntry: false }), { showSidebarEntry: false });
  assert.equal(bindSpec.decode({}), undefined);
  const overlay = registrations.get('shell.overlay');
  const settingsCard = registrations.get('settings.plugin.item');
  assert.ok(settingsCard, 'the MCP Connector card must be registered on the native plugin settings page');
  assert.equal(settingsCard.options.key, 'mcp-connector');
  assert.equal(settingsCard.options.store, overlay.options.store, 'the shortcut button must reuse the existing dialog Store');

  const store = overlay.options.store.create();
  assert.equal(store.getSnapshot().sidebarVisible, false);
  settings.scope.publish({
    ...settings.scope.getSnapshot(),
    value: { showSidebarEntry: true },
    user: { showSidebarEntry: true },
    revision: 2,
  });
  assert.equal(store.getSnapshot().sidebarVisible, true);
  settings.scope.publish({ status: 'unavailable', writable: false, mode: 'memory' });
  assert.equal(store.getSnapshot().sidebarVisible, true, 'it should fail-open when unavailable');
});

test('the settings card can hide the entry, reset the default and open the existing dialog directly', async () => {
  const settings = mutableSettingsScope({
    status: 'ready',
    value: { showSidebarEntry: true },
    base: { showSidebarEntry: true },
    user: { showSidebarEntry: true },
    writable: true,
    mode: 'host',
    revision: 1,
  });
  let stateCursor = 0;
  const jsxRuntime = {
    jsx(type, props) { return { type, props }; },
    jsxs(type, props) { return { type, props }; },
  };
  const plugin = await loadClient({
    jsxRuntime,
    clientDocument: {
      documentElement: { lang: 'zh-CN' },
      querySelector: () => null,
      createElement: () => ({ dataset: {}, remove() {} }),
      head: { append() {} },
    },
    reactApi: {
      useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); },
      useState(initial) {
        const current = stateCursor === 0 ? true : initial;
        stateCursor += 1;
        return [current, () => {}];
      },
    },
  });
  const { ctx, registrations } = clientContext({ settingsScope: { bind: () => settings.scope } });
  plugin.apply(ctx);
  const registration = registrations.get('settings.plugin.item');
  let opens = 0;
  const tree = registration.component({
    ...registration.options.inject(),
    actions: { open() { opens += 1; } },
  });
  const descendants = [];
  const visit = (node) => {
    if (node == null || typeof node !== 'object') return;
    descendants.push(node);
    const children = node.props?.children;
    for (const child of Array.isArray(children) ? children : [children]) visit(child);
  };
  visit(tree);

  const toggle = descendants.find((node) => node.type === 'input' && node.props?.role === 'switch');
  const reset = descendants.find((node) => node.type === 'button' && node.props?.children === 'Reset to default');
  const open = descendants.find((node) => node.type === 'button' && node.props?.children === 'Open MCP Connector');
  assert.ok(toggle);
  assert.ok(reset);
  assert.ok(open);

  toggle.props.onChange({ target: { checked: false } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(settings.writes[0], ['set', 'showSidebarEntry', false]);

  reset.props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(settings.writes[1], ['unset', 'showSidebarEntry']);

  open.props.onClick();
  assert.equal(opens, 1);
});

test('the hidden state creates no sidebar Portal or observer', async () => {
  let observers = 0;
  const plugin = await loadClient({
    jsxRuntime: {
      jsx(type, props) { return { type, props }; },
      jsxs(type, props) { return { type, props }; },
    },
    reactApi: {
      useState(initial) { return [initial, () => {}]; },
      useEffect(start) { start(); },
    },
    windowExtras: {
      MutationObserver: class {
        constructor() { observers += 1; }
        observe() {}
        disconnect() {}
      },
    },
  });
  const { ctx, registrations } = clientContext();
  plugin.apply(ctx);
  const entry = registrations.get('sidebar.footer.action');
  const rendered = entry.component({
    wide: true,
    useStore: (select) => select({ open: false, sidebarVisible: false }),
    actions: { open() {} },
  });
  assert.equal(rendered, null);
  assert.equal(observers, 0);
});

test('the sidebar entry is hosted by public slots, with a Portal above the workspace and a footer fallback', async () => {
  let hookState = null;
  let topMount = null;
  let portal = null;
  const workspaceSlot = { parentElement: null };
  const parent = {
    querySelector(selector) {
      return selector === '[data-mcp-connector-top-mount="true"]' ? topMount : null;
    },
    insertBefore(node, before) {
      topMount = node;
      node.nextSibling = before;
    },
  };
  workspaceSlot.parentElement = parent;
  const clientDocument = {
    querySelector(selector) {
      return selector === '[data-slot="sidebar.workspaces"]' ? workspaceSlot : null;
    },
    createElement(tag) {
      return { tag, dataset: {}, nextSibling: null, remove() {} };
    },
    head: { append() {} },
    body: {},
  };
  class MutationObserverStub {
    observe() {}
    disconnect() {}
  }
  const jsxRuntime = {
    jsx(type, props) { return { type, props }; },
    jsxs(type, props) { return { type, props }; },
  };
  const plugin = await loadClient({
    clientDocument,
    jsxRuntime,
    reactApi: {
      useState(initial) {
        if (hookState === null) hookState = initial;
        return [hookState, (value) => {
          hookState = typeof value === 'function' ? value(hookState) : value;
        }];
      },
      useEffect(start) { start(); },
    },
    reactDomApi: {
      createPortal(node, target) {
        portal = { node, target };
        return portal;
      },
    },
    windowExtras: { MutationObserver: MutationObserverStub },
  });
  const { ctx, registrations } = clientContext();
  plugin.apply(ctx);
  const entry = registrations.get('sidebar.footer.action');
  assert.ok(entry, 'the entry lifecycle must be hosted by the public footer list slot');

  const props = {
    wide: true,
    useStore: (select) => select({ open: false }),
    actions: { open() {} },
  };
  const fallback = entry.component(props);
  assert.equal(fallback.props['aria-label'], 'MCP Connector', 'the footer fallback entry must be kept before the first location attempt');
  assert.equal(fallback.props['data-placement'], 'footer', 'the fallback entry should only style itself and must not take over the Host slot');
  assert.equal(fallback.props.children[0].props.className, 'mcpConnectorLauncherIcon');
  assert.equal(fallback.props.children[0].props['aria-hidden'], true);
  assert.equal(fallback.props.children[1].props.className, 'mcpConnectorLauncherLabel');
  assert.equal(fallback.props.children[1].props.children, 'MCP Connector');
  assert.equal(topMount.dataset.mcpConnectorTopMount, 'true');
  assert.equal(topMount.nextSibling, workspaceSlot, 'the mount point should sit immediately before the workspace slot');

  entry.component(props);
  assert.equal(portal.target, topMount, 'after a successful location it should Portal into the top mount point');
  assert.equal(portal.node.props.className, 'mcpConnectorTopEntry');
  assert.equal(portal.node.props.children.props['data-placement'], 'top');
  entry.component({ ...props, wide: false });
  const collapsed = portal.node.props.children;
  assert.equal(collapsed.props['aria-label'], 'MCP Connector');
  assert.equal(collapsed.props.children[1], null, 'the collapsed sidebar shows only the icon but keeps the accessible name');

  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /hHd-Xa_/, 'it must not depend on DSH build-generated CSS class names');
});

test('DSH 0.2 registers main and the native panellist first and creates no footer fallback entry', async () => {
  const plugin = await loadClient({
    jsxRuntime: {
      jsx(type, props) { return { type, props }; },
      jsxs(type, props) { return { type, props }; },
    },
  });
  const layout = {
    panelInfo: { getSnapshot: () => ({ activePanelId: null }) },
    selectPanel() {},
  };
  const { ctx, registrations, registrationOrder } = clientContext({ nativeSidebar: true, layout });
  plugin.apply(ctx);

  const main = registrations.get('main');
  const entry = registrations.get('sidebar.panellist');
  const overlay = registrations.get('shell.overlay');
  assert.ok(main, 'the native main panel must be registered');
  assert.ok(entry, 'the native panellist row must be registered');
  assert.equal(registrations.has('sidebar.footer.action'), false, 'a new Host must not register the footer fallback entry');
  assert.ok(registrationOrder.indexOf('main') < registrationOrder.indexOf('sidebar.panellist'), 'main must be registered before the clickable row');
  assert.equal(entry.options.id, 'mcp-connector');
  assert.equal(entry.options.order, 40);
  assert.equal(entry.options.label, 'MCP Connector');
  assert.equal(main.options.key, 'mcp-connector');
  assert.equal(main.options.store, overlay.options.store, 'the native panel and the settings dialog must share the market Store');
  assert.equal(main.options.inject().presentation, 'panel');

  const icon = entry.component({ size: 18, active: true });
  assert.equal(icon.type, 'svg');
  assert.equal(icon.props.width, 18);
  assert.equal(icon.props.height, 18);
  assert.equal(icon.props.stroke, 'currentColor');
  assert.equal(icon.props['aria-hidden'], 'true');
});

test('the native main renders the shared market body directly and creates no modal Portal', async () => {
  let portals = 0;
  const selections = [];
  const jsxRuntime = {
    jsx(type, props) { return { type, props }; },
    jsxs(type, props) { return { type, props }; },
  };
  const plugin = await loadClient({
    jsxRuntime,
    reactApi: {
      useState(initial) { return [initial, () => {}]; },
      useRef(initial) { return { current: initial }; },
      useEffect() {},
    },
    reactDomApi: {
      createPortal() { portals += 1; },
    },
    windowExtras: { location: { origin: 'http://127.0.0.1:3080' } },
  });
  const layout = {
    panelInfo: { getSnapshot: () => ({ activePanelId: 'mcp-connector' }) },
    selectPanel(id) { selections.push(id); },
  };
  const { ctx, registrations } = clientContext({ nativeSidebar: true, layout });
  plugin.apply(ctx);
  const main = registrations.get('main');
  const tree = main.component({
    ...main.options.inject(),
    useStore: (select) => select({ open: false, detailOpen: false }),
    actions: { close() {}, detailOpened() {}, detailClosed() {} },
  });

  assert.equal(portals, 0);
  assert.equal(tree.props.role, 'region');
  assert.equal(tree.props['aria-modal'], undefined);
  assert.equal(tree.props['aria-labelledby'], 'mcp-connector-native-title');
  assert.equal(tree.props.style.width, '100%');
  assert.equal(tree.props.style.height, '100%');
  const header = tree.props.children[0];
  const close = header.props.children[1];
  assert.equal(close.props['aria-label'], 'Back to session');
  close.props.onClick();
  assert.deepEqual(selections, [null]);
});

test('hiding the native entry first returns to the session and unregisters the row, and re-enabling restores it', async () => {
  const settings = mutableSettingsScope({
    status: 'ready',
    value: { showSidebarEntry: true },
    base: { showSidebarEntry: true },
    user: { showSidebarEntry: true },
    writable: true,
    mode: 'host',
    revision: 1,
  });
  let activePanelId = 'mcp-connector';
  const selections = [];
  const layout = {
    panelInfo: { getSnapshot: () => ({ activePanelId }) },
    selectPanel(id) {
      selections.push(id);
      activePanelId = id;
    },
  };
  const plugin = await loadClient();
  const { ctx, registrations } = clientContext({
    nativeSidebar: true,
    layout,
    settingsScope: { bind: () => settings.scope },
  });
  plugin.apply(ctx);
  assert.ok(registrations.has('sidebar.panellist'));

  settings.scope.publish({
    ...settings.scope.getSnapshot(),
    value: { showSidebarEntry: false },
    user: { showSidebarEntry: false },
    revision: 2,
  });
  assert.deepEqual(selections, [null], 'it must return to the session before hiding the current panel');
  assert.equal(registrations.has('sidebar.panellist'), false);
  assert.ok(registrations.has('main'), 'the main page is kept to avoid slot lifecycle churn');

  settings.scope.publish({
    ...settings.scope.getSnapshot(),
    value: { showSidebarEntry: true },
    user: { showSidebarEntry: true },
    revision: 3,
  });
  assert.ok(registrations.has('sidebar.panellist'), 'the native row must be restored after re-enabling');
  assert.equal(registrations.has('sidebar.footer.action'), false);
});

test('a late native slot atomically replaces the footer fallback entry', async () => {
  const plugin = await loadClient();
  const layout = {
    panelInfo: { getSnapshot: () => ({ activePanelId: null }) },
    selectPanel() {},
  };
  const { ctx, registrations, slotControls } = clientContext({ layout });
  plugin.apply(ctx);
  assert.ok(registrations.has('sidebar.footer.action'), 'an old Host starts with the fallback entry');

  slotControls.declare('main');
  assert.ok(registrations.has('sidebar.footer.action'), 'the usable entry must not be removed early when only main arrives');
  slotControls.declare('sidebar.panellist');
  assert.equal(registrations.has('sidebar.footer.action'), false);
  assert.ok(registrations.has('sidebar.panellist'));

  slotControls.remove('sidebar.panellist');
  assert.equal(registrations.has('sidebar.panellist'), false);
  assert.ok(registrations.has('sidebar.footer.action'), 'the fallback entry must be restored after the native slot is removed');
});

test('the sidebar entry and the panel title icons are both monochrome line SVG, with no emoji in the source', async () => {
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  // Both literal emoji and escaped forms must be blocked: \u{1F9E9} escapes are not caught by a literal grep.
  assert.doesNotMatch(source, /🧩/, 'colour emoji must no longer be used as icons');
  assert.doesNotMatch(source, /\\u\{1F[0-9A-Fa-f]{3}\}/, 'must not use \\u{...} escaped emoji as icons');
  assert.doesNotMatch(source, /[\u{1F000}-\u{1FAFF}]/u, 'emoji characters must not appear directly in the client source');

  const icon = (className, span = 900) => {
    const marker = source.indexOf(`className: "${className}"`);
    assert.ok(marker > -1, `the ${className} icon container must be kept`);
    const block = source.slice(marker, marker + span);
    assert.match(block, /viewBox: "0 0 16 16"/, `${className} should use a 16x16 viewBox consistent with the Host icon`);
    assert.match(block, /fill: "none"/, `${className} should be drawn as a stroke`);
    assert.match(block, /stroke: "currentColor"/, `${className} should inherit the text colour and follow the light/dark theme`);
    assert.match(block, /strokeLinejoin: "round"|strokeLinecap: "round"/, `${className} should use rounded line endpoints`);
    return block;
  };
  icon('mcpConnectorLauncherIcon');
  icon('mcpConnectorMarketIcon');

  const sidebarCss = source.split('const sidebarCss = `')[1].split('`;')[0];
  const overlayCss = source.split('const overlayCss = `')[1].split('`;')[0];
  assert.match(sidebarCss, /\.mcpConnectorLauncherIcon > svg \{[\s\S]*?width: 18px;[\s\S]*?height: 18px;/, 'the entry icon size should be defined by the styles');
  assert.match(overlayCss, /\.mcpConnectorMarketIcon > svg \{[\s\S]*?width: 18px;[\s\S]*?height: 18px;/, 'the panel title icon size should be defined by the styles');
  assert.doesNotMatch(sidebarCss, /font-size: 18px/, 'the emoji font-size style should be removed');
  assert.doesNotMatch(source, /style: \{ fontSize: 22 \}/, 'the panel title emoji font-size inline style should be removed');
});

test('the sidebar entry has no hover outline, keeps the keyboard focus visible, and the layout uses no negative margins or text-space alignment (#86)', async () => {
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  const css = source.split('const sidebarCss = `')[1].split('`;')[0];
  const rule = (selector) => css.slice(css.indexOf(selector + ' {')).split('}')[0];
  assert.match(rule('.mcpConnectorLauncher:hover'), /outline: none/);
  assert.doesNotMatch(rule('.mcpConnectorLauncher:hover'), /outline: 2px/);
  assert.match(rule('.mcpConnectorLauncher:focus-visible'), /outline: 2px solid currentColor/);
  assert.match(rule('.mcpConnectorLauncher:focus-visible'), /outline-offset: -2px/);
  assert.match(rule('.mcpConnectorLauncher'), /padding: 0 var\(--dsh-sidebar-inline-padding, 12px\)/);
  assert.match(rule('.mcpConnectorLauncher'), /gap: 8px/);
  assert.doesNotMatch(css, /calc\(100% \+|margin: 4px -2px/);
  assert.match(rule('.mcpConnectorLauncherIcon'), /flex: 0 0 20px/);
});

test('the sidebar styles do not rewrite the Host footer slot or the flex layout of other plugins (#124)', async () => {
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  const css = source.split('const sidebarCss = `')[1].split('`;')[0];
  const rule = (selector) => css.slice(css.indexOf(selector + ' {')).split('}')[0];
  assert.doesNotMatch(css, /\[data-slot=["']sidebar\.footer\.action["']\]/, 'it must not override the Host display: contents anchor');
  assert.doesNotMatch(css, /sidebar\.footer\.action[\s\S]*?>\s*\*/, 'it must not reset third-party plugin children in the same slot');
  const fallbackRule = rule('.mcpConnectorLauncher[data-placement="footer"]');
  assert.match(fallbackRule, /flex: 1 1 0/);
  assert.match(fallbackRule, /max-width: 100%/);
  assert.doesNotMatch(fallbackRule, /!important/);
});

test('the sample Prompt is written into the new session draft before navigation', async () => {
  const plugin = await loadClient();
  const { ctx, registrations, calls } = clientContext();
  plugin.apply(ctx);
  const overlay = registrations.get('shell.overlay');
  assert.ok(overlay, 'the connector dialog must be registered');
  const props = overlay.options.inject();
  await props.startPromptSession('查询企查查的对外投资布局');
  assert.deepEqual(calls, [
    ['connectWorkspace', 'workspace-1'],
    ['setDraft', '查询企查查的对外投资布局'],
    ['open', 'session-new'],
  ]);
});

test('DSH 0.1.2 can create a Prompt session when only uiWorkspace is provided', async () => {
  const plugin = await loadClient();
  const { ctx, registrations, calls } = clientContext({ workspaceNavigation: 'ui' });
  plugin.apply(ctx);
  const props = registrations.get('shell.overlay').options.inject();
  await props.startPromptSession('查询 SHOPLINE 商品创建接口');
  assert.deepEqual(calls, [
    ['uiConnectWorkspace', 'workspace-1'],
    ['setDraft', '查询 SHOPLINE 商品创建接口'],
    ['open', 'session-new'],
  ]);
});

test('it safely degrades to sessions.create when no workspace navigation bridge is available', async () => {
  const plugin = await loadClient();
  const { ctx, registrations, calls } = clientContext({ workspaceNavigation: 'sessions' });
  plugin.apply(ctx);
  const props = registrations.get('shell.overlay').options.inject();
  await props.startPromptSession('查询 SHOPLINE GraphQL Schema');
  assert.deepEqual(calls, [
    ['create', { workspaceId: 'workspace-1' }],
    ['setDraft', '查询 SHOPLINE GraphQL Schema'],
    ['open', 'session-new'],
  ]);
});

test('it returns an actionable error when no session creation capability is available', async () => {
  const plugin = await loadClient();
  const { ctx, registrations } = clientContext({ workspaceNavigation: 'none' });
  plugin.apply(ctx);
  const props = registrations.get('shell.overlay').options.inject();
  await assert.rejects(
    () => props.startPromptSession('示例'),
    /cannot create a workspace session/,
  );
});

test('the market iframe can read the current Workspace as the project connection scope', async () => {
  const plugin = await loadClient();
  const { ctx, registrations } = clientContext({ workspaceId: 'workspace-scope' });
  plugin.apply(ctx);
  const props = registrations.get('shell.overlay').options.inject();
  assert.deepEqual(props.workspaceContext(), {
    workspaceId: 'workspace-scope',
    title: 'workspace-scope',
  });
  assert.deepEqual(props.workspaceOptions(), [{
    workspaceId: 'workspace-scope',
    title: 'workspace-scope',
  }]);
});

test('with no current session it still offers every Workspace to the market for explicit selection', async () => {
  const plugin = await loadClient();
  const { ctx, registrations } = clientContext({
    workspaceId: null,
    recentWorkspaceId: undefined,
    workspaceItems: [
      { workspaceId: 'workspace-a', title: '项目 A', sessionIds: [] },
      { workspaceId: 'workspace-b', title: '项目 B', sessionIds: [] },
    ],
  });
  plugin.apply(ctx);
  const props = registrations.get('shell.overlay').options.inject();
  assert.equal(props.workspaceContext(), null);
  assert.deepEqual(props.workspaceOptions(), [
    { workspaceId: 'workspace-a', title: '项目 A' },
    { workspaceId: 'workspace-b', title: '项目 B' },
  ]);
});

test('it gives a clear error when there is no workspace instead of failing silently', async () => {
  const plugin = await loadClient();
  const { ctx, registrations } = clientContext({ workspaceId: null });
  plugin.apply(ctx);
  const props = registrations.get('shell.overlay').options.inject();
  await assert.rejects(() => props.startPromptSession('示例'), /Select a workspace before using the sample prompt/);
});

test('the market dialog has theme and keyboard accessibility styles', async () => {
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  assert.match(source, /prefers-color-scheme: dark/);
  assert.match(source, /aria-modal/);
  assert.match(source, /event\.key !== "Escape"/);
  assert.match(source, /mcpConnectorMarketClose:focus-visible/);
  assert.match(source, /const opener = document\.activeElement/);
  assert.match(source, /opener\?\.focus\?\.\(\)/);
  assert.match(source, /event\.stopPropagation\(\)/);
  assert.match(source, /addEventListener\("keydown", onKeyDown, true\)/);
});

test('opening the dialog from settings Portals to body and sits above the DSH settings layer', async () => {
  const body = {};
  let portal;
  const jsxRuntime = {
    jsx(type, props) { return { type, props }; },
    jsxs(type, props) { return { type, props }; },
  };
  const plugin = await loadClient({
    clientDocument: {
      body,
      querySelector: () => null,
      createElement: () => ({ dataset: {}, remove() {} }),
      head: { append() {} },
    },
    jsxRuntime,
    reactApi: {
      useState(initial) { return [initial, () => {}]; },
      useRef(initial) { return { current: initial }; },
      useEffect() {},
    },
    reactDomApi: {
      createPortal(node, target) {
        portal = { node, target };
        return portal;
      },
    },
    windowExtras: { location: { origin: 'http://127.0.0.1:3080' } },
  });
  const { ctx, registrations } = clientContext();
  plugin.apply(ctx);
  const component = registrations.get('shell.overlay').component;
  const rendered = component({
    wide: true,
    useStore: (select) => select({ open: true, detailOpen: false }),
    actions: { close() {}, detailOpened() {}, detailClosed() {} },
    startPromptSession() {},
  });

  assert.equal(rendered, portal);
  assert.equal(portal.target, body, 'it must escape the shell.overlay z-index:20 stacking context');
  assert.ok(portal.node.props.style.zIndex > 1000, 'it must sit above the DSH Settings z-index:1000');
});

test('the version check supports a forced refresh and a stale cache cannot hide a Provider update', async () => {
  for (const failed of [false, true]) {
    const state = [
      { installedVersion: '0.2.54', latestVersion: '0.2.54', updateAvailable: false, checkedAt: '2026-09-22T00:00:00Z' },
      'ready', { provider: { label: '市场' } },
      { installedVersion: '0.2.54', latestVersion: '0.2.56', updateAvailable: true },
      null, null, null, false, false, false, false, 0, false, failed,
    ];
    let cursor = 0;
    let refresh = 0;
    const plugin = await loadClient({
      windowExtras: { location: { origin: 'http://127.0.0.1:3080' } },
      jsxRuntime: { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
      reactApi: {
        useState(initial) {
          const index = cursor++;
          return [index in state ? state[index] : initial, (value) => {
            if (index === 11) refresh = value(refresh);
          }];
        },
        useRef: (current) => ({ current }), useEffect() {},
      },
    });
    const { ctx, registrations } = clientContext();
    plugin.apply(ctx);
    const tree = registrations.get('shell.overlay').component({
      wide: true, useStore: (select) => select({ open: true, detailOpen: false }),
      actions: { close() {}, detailOpened() {}, detailClosed() {} }, startPromptSession() {},
    });
    const nodes = [];
    function visit(node) {
      if (!node || typeof node !== 'object') return;
      nodes.push(node);
      const children = node.props?.children;
      for (const child of Array.isArray(children) ? children : [children]) visit(child);
    }
    visit(tree);
    assert.ok(nodes.some((node) => node.props?.children === 'Update in one click to v0.2.56'));
    const button = nodes.find((node) => node.props?.children === 'Check for updates');
    assert.equal(button.props.disabled, false);
    assert.match(button.props.title, /Last checked/);
    button.props.onClick();
    assert.equal(refresh, 1);
    assert.equal(nodes.some((node) => node.props?.children === 'The latest npm version cannot be confirmed right now. Please retry'), failed);
  }
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  assert.match(source, /params: \{ force \}/);
  assert.match(source, /check\(true\)/);
  assert.equal(source.match(/\[open, versionCheckRequest\]/g).length, 2, 'a manual refresh re-checks both the version and the Provider');
});

test('the market title shows the installed version and offers a one-click update through the Provider adapter', async () => {
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  assert.match(source, /method: "versionStatus"/);
  assert.match(source, /VERSION_CHECK_INTERVAL_MS = 6 \* 60 \* 60 \* 1e3/);
  assert.match(source, /VERSION_CHECK_RETRY_MS = 5 \* 60 \* 1e3/);
  assert.match(source, /Date\.parse\(status\.nextCheckAt/);
  assert.match(source, /mcpConnectorVersion/);
	assert.match(source, /UPDATE_PROVIDER_ADAPTERS = Object\.freeze/);
	assert.match(source, /createHttpUpdateProviderAdapter/);
	assert.match(source, /discoverUpdateProvider/);
	assert.match(source, /sameOriginProviderEndpoint/);
	assert.match(source, /url\.origin !== window\.location\.origin/);
	assert.match(source, /schema: "dsh-market\/update-api\/v1"/);
	assert.match(source, /capabilitiesUrl: "\/dsh-market\/api\/v1\/capabilities"/);
	assert.match(source, /provider\.start\(capabilities, PLUGIN_PACKAGE_NAME/);
	assert.match(source, /provider\.operation\(capabilities, operationId\)/);
	assert.match(source, /provider\.rollback\(capabilities, updateOperation\.operationId\)/);
	assert.match(source, /completedUpdateIntegrityFailure\(operation, expectedUpdateVersion\)/);
	assert.match(source, /provider\.rollback\(capabilities, operationId\)/);
	assert.match(source, /DOWNGRADE_DETECTED/);
	assert.match(source, /RESOLVED_VERSION_MISMATCH/);
	assert.match(source, /provider\.restart\(capabilities\)/);
  assert.match(source, /Update in one click to v/);
  assert.match(source, /Updating/);
  assert.match(source, /failure\?\.retryable/);
	assert.match(source, /capabilities\?\.restart\?\.supported === true/);
  assert.match(source, /Please restart DSH Desktop/);
  assert.match(source, /window\.location\.reload\(\)/);
	assert.doesNotMatch(source, /"\/dsh-market\/update"/, 'it must not call the Market unversioned private update endpoint');
	assert.doesNotMatch(source, /const MARKET_(?:UPDATES|OPERATIONS|ROLLBACK|RESTART)_URL/, 'the UI must not hard-code Provider operation endpoints');
  assert.match(source, /The new release is still in its safety wait period \(about 24 hours\)/);
  assert.match(source, /Update now \(skip the wait\)/);
  assert.match(source, /manualUpgradeCommand/);
  assert.match(source, /--config\.minimumReleaseAge=0/);
  assert.match(source, /Copy upgrade command/);
  assert.match(source, /\[data-slot="sidebar\.settings"\]/);
  assert.match(source, /\^\(\\u63d2\\u4ef6\\u5e02\\u573a\|Plugin Market\|Plugin Marketplace\)\$/);
  assert.match(source, /window\.open\(NPM_PACKAGE_URL, "_blank", "noopener,noreferrer"\)/);
  assert.doesNotMatch(source, /registry\.npmjs\.org/, 'the client must not request the version source cross-origin');
});

test('it falls back to npm update instructions when the DSH Desktop settings have no plugin market', async () => {
  let settingsClicks = 0;
  const opened = [];
  const settingsTrigger = { click() { settingsClicks += 1; } };
  const plugin = await loadClient({
    clientDocument: {
      querySelector(selector) {
        if (selector !== '[data-slot="sidebar.settings"]') return null;
        return { querySelector: () => settingsTrigger };
      },
      querySelectorAll: () => [],
      createElement: () => ({ dataset: {}, remove() {} }),
      head: { append() {} },
    },
    windowExtras: {
      setTimeout(callback) { callback(); return 1; },
      requestAnimationFrame(callback) { callback(); return 1; },
      open(...args) { opened.push(args); },
    },
    sourceTransform(source) {
      return source.replace(
        '\t\texports.apply = apply;',
        '\t\texports.__testOpenDshPluginMarket = openDshPluginMarket;\n\t\texports.apply = apply;',
      );
    },
  });
  let closes = 0;
  plugin.__testOpenDshPluginMarket({ close() { closes += 1; } });
  assert.equal(closes, 1);
  assert.equal(settingsClicks, 1);
  assert.deepEqual(opened, [[
    'https://www.npmjs.com/package/dsh-mcp-connector', '_blank', 'noopener,noreferrer',
  ]]);
});

test('the client independently rejects a Provider downgrade, a wrong target and an invalid success result', async () => {
  const plugin = await loadClient({
    sourceTransform(source) {
      return source.replace(
        '\t\texports.apply = apply;',
        '\t\texports.__testCompletedUpdateIntegrityFailure = completedUpdateIntegrityFailure;\n\t\texports.apply = apply;',
      );
    },
  });
  const verify = plugin.__testCompletedUpdateIntegrityFailure;
  assert.equal(typeof verify, 'function');
  assert.equal(verify({ state: 'running' }, '0.2.25'), null);
  assert.equal(verify({
    state: 'succeeded', beforeVersion: '0.2.24', installedVersion: '0.2.25',
  }, '0.2.25'), null);
  assert.deepEqual(verify({
    state: 'succeeded', beforeVersion: '0.2.24', installedVersion: '0.2.23',
  }, '0.2.25'), {
    code: 'DOWNGRADE_DETECTED',
    message: 'The update service downgraded the plugin from v0.2.24 to v0.2.23',
    retryable: false,
  });
  assert.deepEqual(verify({
    state: 'succeeded', beforeVersion: '0.2.24', installedVersion: '0.2.26',
  }, '0.2.25'), {
    code: 'RESOLVED_VERSION_MISMATCH',
    message: 'Expected v0.2.25 to be installed, but the update service installed v0.2.26',
    retryable: true,
  });
  assert.equal(verify({
    state: 'succeeded', beforeVersion: '1.0.0-beta.2', installedVersion: '1.0.0-beta.1',
  }, '1.0.0-beta.3').code, 'DOWNGRADE_DETECTED');
  assert.equal(verify({ state: 'succeeded', beforeVersion: '0.2.24' }, '0.2.25').code, 'INVALID_UPDATE_RESULT');
});

test('the update failure copy distinguishes the release safety wait from mirror sync', async () => {
  const plugin = await loadClient({
    sourceTransform(source) {
      return source.replace(
        '\t\texports.apply = apply;',
        '\t\texports.__testUpdateFailureLabel = updateFailureLabel;\n\t\texports.apply = apply;',
      );
    },
  });
  const label = plugin.__testUpdateFailureLabel;
  assert.equal(label({ code: 'RELEASE_TOO_FRESH' }), 'The new release is still in its safety wait period (about 24 hours)');
  assert.equal(label({ code: 'MIRROR_SYNC_PENDING' }), 'The mirror has not synced the full package yet');
  assert.equal(label({ code: 'UNKNOWN', message: '镜像返回的安装包尚不可用' }), '镜像返回的安装包尚不可用');
});

test('a disk version higher than the running version is recognised as pending restart, without repeating the install prompt', async () => {
  const plugin = await loadClient({
    sourceTransform(source) {
      return source.replace(
        '\t\texports.apply = apply;',
        '\t\texports.__testPendingActivationVersion = pendingActivationVersion;\n\t\texports.apply = apply;',
      );
    },
  });
  const pending = plugin.__testPendingActivationVersion;
  assert.equal(pending(
    { installedVersion: '0.2.30', latestVersion: '0.2.31', updateAvailable: true },
    { installedVersion: '0.2.31', latestVersion: '0.2.31', updateAvailable: false },
  ), '0.2.31');
  assert.equal(pending(
    { installedVersion: '0.2.31' },
    { installedVersion: '0.2.31', latestVersion: '0.2.31', updateAvailable: false },
  ), null);
  assert.equal(pending(
    { installedVersion: '0.2.30' },
    { installedVersion: '0.2.31', latestVersion: '0.2.32', updateAvailable: true },
  ), null, 'the one-click update must still be shown while a higher version exists');
  assert.equal(pending(
    { installedVersion: 'invalid' },
    { installedVersion: '0.2.31', updateAvailable: false },
  ), null);

  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  assert.match(source, /v\$\{activationPendingVersion\} is installed and takes effect after a restart/);
  assert.match(source, /pendingActivationVersion\(versionStatus, providerUpdateCheck\)/);
});

test('a newly installed version renders a restart hint in the old process instead of an upgrade command', async () => {
  const state = [
    { installedVersion: '0.2.30', latestVersion: '0.2.31', updateAvailable: true },
    'ready',
    {
      provider: { id: 'market-v1', label: 'DSH 插件市场' },
      capabilities: {
        runtime: 'web',
        restart: { supported: false, managedBy: 'operator' },
      },
    },
    { installedVersion: '0.2.31', latestVersion: '0.2.31', updateAvailable: false },
    null,
    null,
    null,
    false,
    false,
    false,
    false,
  ];
  let stateCursor = 0;
  const jsxRuntime = {
    jsx(type, props) { return { type, props }; },
    jsxs(type, props) { return { type, props }; },
  };
  const plugin = await loadClient({
    jsxRuntime,
    windowExtras: { location: { origin: 'http://127.0.0.1:3080' } },
    reactApi: {
      useState(initial) {
        const index = stateCursor++;
        return [index in state ? state[index] : initial, () => {}];
      },
      useRef(initial) { return { current: initial }; },
      useEffect() {},
    },
  });
  const { ctx, registrations } = clientContext();
  plugin.apply(ctx);
  const component = registrations.get('shell.overlay').component;
  const tree = component({
    wide: true,
    useStore: (select) => select({ open: true, detailOpen: false }),
    actions: { close() {}, detailOpened() {}, detailClosed() {} },
    startPromptSession() {},
  });
  const descendants = [];
  const visit = (node) => {
    if (node == null || node === false || typeof node !== 'object') return;
    descendants.push(node);
    const children = node.props?.children;
    for (const child of Array.isArray(children) ? children : [children]) visit(child);
  };
  visit(tree);
  assert.ok(descendants.some((node) => node.props?.children === 'v0.2.31 is installed and takes effect after a restart'));
  assert.ok(descendants.some((node) => node.props?.children === 'Please restart DSH'));
  assert.equal(descendants.some((node) => node.type === 'code'), false);
  assert.equal(descendants.some((node) => node.props?.children === 'Copy upgrade command'), false);
});

test('after capability detection passes it renders a one-click update and uses the same-origin endpoint advertised by the Provider', async () => {
  const requests = [];
  const effects = [];
  const state = [];
  let stateCursor = 0;
  const jsxRuntime = {
    jsx(type, props) { return { type, props }; },
    jsxs(type, props) { return { type, props }; },
  };
  const reactApi = {
    useState(initial) {
      const index = stateCursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => {
        state[index] = typeof value === 'function' ? value(state[index]) : value;
      }];
    },
    useRef(initial) { return { current: initial }; },
    useEffect(start) { effects.push(start); },
  };
  const fetch = async (url, options = {}) => {
    requests.push([String(url), options.method ?? 'GET', options.body]);
    if (url === '/mcp-connector/api') {
      return new Response(JSON.stringify({
        ok: true,
        detail: {
          installedVersion: '0.2.24',
          latestVersion: '0.2.25',
          updateAvailable: true,
          checking: false,
          nextCheckAt: new Date(Date.now() + 60_000).toISOString(),
        },
      }), { status: 200 });
    }
	if (url === '/dsh-market/api/v1/capabilities') {
		return new Response(JSON.stringify({
			schema: 'dsh-market/update-api/v1',
			apiVersion: 1,
			runtime: 'web',
			features: { update: true, progress: true, rollback: true, restart: true },
			restart: { supported: true, managedBy: 'market' },
			endpoints: {
				updates: '/test-update-provider/v1/updates',
				operations: '/test-update-provider/v1/operations',
				rollback: '/test-update-provider/v1/rollback',
				restart: '/test-update-provider/v1/restart',
			},
		}), { status: 200 });
	}
	if (String(url).startsWith('/test-update-provider/v1/updates?')) {
      return new Response(JSON.stringify({
        schema: 'dsh-market/update-api/v1',
        package: {
          name: 'dsh-mcp-connector',
          installedVersion: '0.2.24',
          latestVersion: '0.2.25',
          updateAvailable: true,
        },
      }), { status: 200 });
    }
	if (url === '/test-update-provider/v1/updates' && options.method === 'POST') {
      return new Response(JSON.stringify({
        schema: 'dsh-market/update-api/v1',
        operation: {
          operationId: 'boot-update-1',
          state: 'running',
          progress: { percent: 25 },
          outcome: { rollback: { available: false, state: 'unavailable' } },
        },
      }), { status: 202 });
    }
    throw new Error(`unexpected request: ${url}`);
  };
  const plugin = await loadClient({
    jsxRuntime,
    reactApi,
    windowExtras: {
      fetch,
      location: { origin: 'http://127.0.0.1:3080', reload() {} },
      addEventListener() {},
      removeEventListener() {},
      setTimeout() { return 1; },
      clearTimeout() {},
      requestAnimationFrame(callback) { callback(); },
      open() {},
    },
  });
  const { ctx, registrations } = clientContext();
  plugin.apply(ctx);
  const component = registrations.get('shell.overlay').component;
  const props = {
    wide: true,
    useStore: (select) => select({ open: true, detailOpen: false }),
    actions: { close() {}, detailOpened() {}, detailClosed() {} },
    startPromptSession() {},
  };
  const render = () => {
    stateCursor = 0;
    return component(props);
  };
  const descendants = (root) => {
    const result = [];
    const visit = (node) => {
      if (node == null || node === false || typeof node !== 'object') return;
      result.push(node);
      const children = node.props?.children;
      for (const child of Array.isArray(children) ? children : [children]) visit(child);
    };
    visit(root);
    return result;
  };

  render();
  for (const start of effects.splice(0)) start();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  effects.length = 0;
  let tree = render();
  const update = descendants(tree).find((node) => node.type === 'button'
    && node.props?.children === 'Update in one click to v0.2.25');
  assert.ok(update, 'after detecting v1 the one-click update must be available in the current page');
  update.props.onClick();
  await new Promise((resolve) => setImmediate(resolve));

  effects.length = 0;
  tree = render();
  assert.ok(descendants(tree).some((node) => node.props?.children === 'Updating 25%'));
	const mutation = requests.find(([url, method]) => url === '/test-update-provider/v1/updates' && method === 'POST');
  assert.ok(mutation, 'the click must call the update endpoint advertised by the Provider');
  assert.deepEqual(JSON.parse(mutation[2]), { packageName: 'dsh-mcp-connector' });
});

test('it rejects the one-click update and degrades safely when the Provider advertises a cross-origin endpoint', async () => {
  const requests = [];
  const copied = [];
  const effects = [];
  const state = [];
  let stateCursor = 0;
  const jsxRuntime = {
    jsx(type, props) { return { type, props }; },
    jsxs(type, props) { return { type, props }; },
  };
  const reactApi = {
    useState(initial) {
      const index = stateCursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => {
        state[index] = typeof value === 'function' ? value(state[index]) : value;
      }];
    },
    useRef(initial) { return { current: initial }; },
    useEffect(start) { effects.push(start); },
  };
  const fetch = async (url) => {
    requests.push(String(url));
    if (url === '/mcp-connector/api') {
      return new Response(JSON.stringify({
        ok: true,
        detail: {
          installedVersion: '0.2.24',
          latestVersion: '0.2.25',
          updateAvailable: true,
          checking: false,
          nextCheckAt: new Date(Date.now() + 60_000).toISOString(),
        },
      }), { status: 200 });
    }
    if (url === '/dsh-market/api/v1/capabilities') {
      return new Response(JSON.stringify({
        schema: 'dsh-market/update-api/v1',
        apiVersion: 1,
        features: { update: true },
        restart: { supported: false, managedBy: 'operator' },
        endpoints: {
          updates: 'https://evil.example/updates',
          operations: '/safe-looking/operations',
        },
      }), { status: 200 });
    }
    throw new Error(`unexpected request: ${url}`);
  };
  const plugin = await loadClient({
    jsxRuntime,
    reactApi,
    windowExtras: {
      fetch,
      location: { origin: 'http://127.0.0.1:3080', reload() {} },
      addEventListener() {},
      removeEventListener() {},
      setTimeout() { return 1; },
      clearTimeout() {},
      requestAnimationFrame(callback) { callback(); },
      open() {},
      navigator: { clipboard: { async writeText(value) { copied.push(value); } } },
    },
  });
  const { ctx, registrations } = clientContext();
  plugin.apply(ctx);
  const component = registrations.get('shell.overlay').component;
  const props = {
    wide: true,
    useStore: (select) => select({ open: true, detailOpen: false }),
    actions: { close() {}, detailOpened() {}, detailClosed() {} },
    startPromptSession() {},
  };
  const render = () => {
    stateCursor = 0;
    return component(props);
  };
  const descendants = (root) => {
    const result = [];
    const visit = (node) => {
      if (node == null || node === false || typeof node !== 'object') return;
      result.push(node);
      const children = node.props?.children;
      for (const child of Array.isArray(children) ? children : [children]) visit(child);
    };
    visit(root);
    return result;
  };

  render();
  for (const start of effects.splice(0)) start();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  effects.length = 0;
  let tree = render();
  const command = 'dsh plugin --profile web add --config.minimumReleaseAge=0 dsh-mcp-connector@0.2.25';
  assert.ok(descendants(tree).some((node) => node.type === 'code'
    && node.props?.children === command));
  const copyButton = descendants(tree).find((node) => node.type === 'button'
    && node.props?.children === 'Copy upgrade command');
  assert.ok(copyButton, 'without a trusted Provider an upgrade command copy button must be offered');
  copyButton.props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(copied, [command]);

  effects.length = 0;
  tree = render();
  assert.ok(descendants(tree).some((node) => node.type === 'button'
    && node.props?.children === 'Copied'));
  assert.equal(requests.some((url) => url.startsWith('https://evil.example/')), false);
});
