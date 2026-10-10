import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileFunction } from 'node:vm';

const normalizeLineEndings = (source) => source.replace(/\r\n?/g, '\n');
const uiSource = normalizeLineEndings(await readFile(new URL('../ui/index.html', import.meta.url), 'utf8'));
const clientSource = normalizeLineEndings(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const harnessSource = normalizeLineEndings(await readFile(new URL('../scripts/ui-harness.mjs', import.meta.url), 'utf8'));

// The page is one inline <script> block. A single malformed string literal — for
// example an unescaped apostrophe in copy such as "this connection's tools" —
// makes the whole block fail to parse, which silently blanks the panel instead
// of throwing. Assert the block compiles so that class of copy edit cannot ship.
test('the inline UI script parses as valid JavaScript', () => {
  const blocks = [...uiSource.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(blocks.length > 0, 'ui/index.html should contain at least one inline script block');
  for (const [, source] of blocks) {
    assert.doesNotThrow(
      () => compileFunction(source, [], { filename: 'ui/index.html' }),
      'the inline UI script must parse; an unescaped quote in UI copy breaks the entire panel',
    );
  }
});

test('guidance does not append API Key, JSON or URL advice to authorization and local launch errors', () => {
  const start = uiSource.indexOf('  function guidanceFor(');
  const end = uiSource.indexOf('  function showModalError(', start);
  const guide = new Function(`${uiSource.slice(start, end)}; return guidanceFor;`)();
  for (const text of ['DingTalk authorization is pending, wait for the administrator', 'CLI OAuth returned invalid JSON', 'Local MCP initialization failed', 'Connection failed: the first tool sync failed']) {
    assert.equal(guide(text), text);
  }
  assert.match(guide('fetch failed'), /Check the network/);
  assert.match(guide('JSON format error'), /Check the quotes/);
});

test('connection labels distinguish CLI authorization, run location and permissions, and never advertise none as authorization-free', () => {
  const start = uiSource.indexOf('  function connectionLabels(');
  const end = uiSource.indexOf('  function cardHtml(', start);
  const labels = new Function(`${uiSource.slice(start, end)}; return connectionLabels;`)();
  assert.deepEqual(labels({ id: 'dingtalk', vendor: 'DingTalk', authMode: 'none', servers: [{ transport: 'stdio' }] }),
    ['Provider: DingTalk', 'Official CLI OAuth', 'Runs on the DSH Host', 'The current bridge only provides read-only tools']);
  assert.ok(labels({ authMode: 'none' }).includes('Authorize as the service requires'));
  assert.ok(labels({ authMode: 'bearer' }).includes('Bearer credential'));
  assert.ok(labels({ authMode: 'oauth2-pkce' }).includes('OAuth authorization'));
  assert.match(uiSource, /if \(!r.ok\) showModalError\(r.message\)/);
});

test('市场卡片恢复紧凑信息量，运行提示为短标签，完整说明保留在详情与确认框', () => {
  const start = uiSource.indexOf('  function cardHtml(');
  const end = uiSource.indexOf('  function actionHtml(', start);
  const source = uiSource.slice(start, end);
  const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const render = new Function('esc', 'isImageIcon', 'actionHtml', source + '; return cardHtml;')(escape, () => false, () => '<button>Details</button>');
  const remote = { id: 'qcc', name: 'Qichacha', summary: 'Business registration data', vendor: 'Long provider description', servers: [{ transport: 'streamable-http' }] };
  const html = render(remote);
  assert.match(html, /class="name"/);
  assert.match(html, /class="summary"/);
  assert.match(html, /class="actions"/);
  assert.doesNotMatch(html, /class="hint"|class="runtime-tag"|Long provider description|permissions follow/i);
  assert.match(render({ ...remote, servers: [{ transport: 'stdio' }] }), />Local runtime<\/span>/);
  assert.match(render({ ...remote, id: 'dingtalk', servers: [{ transport: 'stdio' }] }), />Local CLI<\/span>/);
  assert.match(render({ ...remote, summary: '<script>bad</script>' }), /&lt;script&gt;/);
  assert.match(uiSource, /\.card \.summary \{[^}]*-webkit-line-clamp: 2/);
  assert.match(uiSource, /connectionLabels\(connector\)\.map\(esc\)\.join/);
  assert.match(uiSource, /connectionLabels\(d\)\.join/);
});

test('installed connections can always inject or enable per session, and it is clear the connection is not disconnected', () => {
  assert.match(uiSource, /class="injection-select"/);
  assert.match(uiSource, />Always inject<\/option>/);
  assert.match(uiSource, /Enable per session[^<]*<\/option>/);
  assert.match(uiSource, /Enabling per session does not disconnect/);
  assert.match(uiSource, /call\('setInjectionMode', \{ key, mode \}\)/);
  assert.match(uiSource, /up to 30 minutes/);
});

test('参数摘要保留必填、嵌套与约束，转义所有远端文本并对复杂结构降级', () => {
  const start = uiSource.indexOf('  function schemaSummary(');
  const end = uiSource.indexOf('  function showToolParameters(', start);
  const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const render = new Function('esc', `${uiSource.slice(start, end)}; return schemaSummary;`)(escape);
  const html = render({ type: 'object', required: ['query'], properties: {
    query: { type: 'string', description: '<img src=x onerror=alert(1)>', minLength: 1 },
    filters: { type: 'object', properties: { names: { type: 'array', items: { type: 'string' } } } },
    target: { oneOf: [{ type: 'string' }, { type: 'number' }] },
  } });
  assert.match(html, /Required/); assert.match(html, /minLength/); assert.match(html, /Array items/);
  assert.match(html, /summary does not represent/); assert.doesNotMatch(html, /<img/); assert.match(html, /&lt;img/);
  let nested = { type: 'string' };
  for (let i = 0; i < 20; i++) nested = { type: 'object', properties: { nested } };
  assert.match(render(nested), /Structure is large/);
});

test('the tool workbench offers filters, paging and separate check/discover actions, with protection against stale responses and workspace switches', () => {
  assert.match(uiSource, /data-view="tools"/);
  assert.match(uiSource, /Filter by connection/); assert.match(uiSource, /Filter by server/);
  assert.match(uiSource, /data-explorer-page="next"/);
  assert.match(uiSource, /data-explorer-action="discover"/); assert.match(uiSource, /data-explorer-action="check"/);
  assert.match(uiSource, /sequence !== explorerSequence/);
  assert.match(uiSource, /requestId !== explorerDetailSequence/);
  assert.match(uiSource, /raw schema/i);
});

test('工具页面排序与缓存搜索一致，精确工具名优先并支持中英混排', async () => {
  const start = uiSource.indexOf('  function normalizeToolSearchText(');
  const end = uiSource.indexOf('  function renderTools()', start);
  const { normalizeToolSearchText, toolSearchScore } = new Function(`${uiSource.slice(start, end)}; return { normalizeToolSearchText, toolSearchScore };`)();
  const { createToolCatalogRecord, searchToolCatalog } = await import('../lib/tool-catalog-cache.js');
  const tools = [
    { name: 'other', description: 'get_company_profile' },
    { name: 'get_company_profile_extended' },
    { name: 'get_company_profile' },
    { name: 'find', title: 'MCP连接器' },
  ];
  const record = createToolCatalogRecord({ key: 'k', connectorId: 'c', serverName: 's', transport: 'stdio' }, tools);
  for (const query of ['get_company_profile', 'MCP连接器', 'find']) {
    const normalized = normalizeToolSearchText(query);
    const uiOrder = tools.filter((tool) => toolSearchScore(tool, normalized) >= 0)
      .sort((a, b) => toolSearchScore(b, normalized) - toolSearchScore(a, normalized) || a.name.localeCompare(b.name)).map((tool) => tool.name);
    assert.deepEqual(uiOrder, searchToolCatalog([record], { query }).map((tool) => tool.name));
  }
});

test('实时详情采用只读缓存、重连补同步与请求合并，已安装连接有工具入口', () => {
  assert.match(uiSource, /source.addEventListener\('ready', scheduleStatusRefresh\)/);
  assert.match(uiSource, /cachedOnly: true/);
  assert.match(uiSource, /if \(statusRefreshRunning\) return/);
  assert.match(uiSource, /showConnectionTools\('/);
});

test('宿主原生面板填满 main 区域，兼容弹窗和截图 harness 保持 800px 尺寸', () => {
  assert.match(clientSource, /width: presentation === "panel" \? "100%" : "min\(800px, 90%\)"/);
  assert.match(clientSource, /height: presentation === "panel" \? "100%" : "min\(800px, 85%\)"/);
  assert.match(clientSource, /if \(presentation === "panel"\) return marketPanel/);
  assert.match(harnessSource, /width: min\(800px, 90vw\)/);
  assert.match(harnessSource, /无凭据 Mock/);
  assert.match(harnessSource, /const connected = new Set\(\);/);
  assert.doesNotMatch(harnessSource, /new Set\(\['qcc-company'\]\)/);
});

test('the interface is English-only and provides no language switch entry', () => {
  assert.match(uiSource, /<html lang="en">/);
  assert.doesNotMatch(uiSource, /id="locale-toggle"/);
  assert.doesNotMatch(uiSource, /mcp-connector:locale/);
  assert.doesNotMatch(uiSource, /Switch language|>EN<\/button>/);
  assert.doesNotMatch(uiSource, /data-i18n/);
  assert.match(uiSource, /const LABELS = \{[\s\S]*?details: 'Details'/);
});

test('目录刷新文案与插件升级明确区分', () => {
  assert.match(uiSource, /id="refresh" title="Refresh connector catalog">Refresh catalog<\/button>/);
  assert.match(uiSource, /call\('refreshCatalog', \{\}\)/);
});

test('内置 Prompt 有默认值时直接发送，无默认值才补全参数', () => {
  assert.match(uiSource, /function promptNeedsInput\(prompt\)/);
  assert.match(uiSource, /if \(!promptNeedsInput\(prompt\)\) \{\s*window\.__mcp\.sendPrompt\(renderResolvedPrompt\(prompt, \{\}\)\)/);
  assert.match(uiSource, /t\(promptNeedsInput\(prompt\) \? 'fillSend' : 'send'\)/);
});

test('参数弹框与发送提示位于详情弹框之上', () => {
  assert.match(uiSource, /\.detail-overlay \{[\s\S]*?z-index: 100;/);
  assert.match(uiSource, /\.modal-mask \{[^}]*z-index: 200;/);
  assert.match(uiSource, /\.toast \{[\s\S]*?z-index: 300;/);
});

test('JSON 导入提供缩进示例、格式化和简洁的本机安全说明', () => {
  assert.match(uiSource, /const MCP_JSON_EXAMPLE = JSON\.stringify\([\s\S]*?null, 2\)/);
  assert.match(uiSource, /formatImportJson\(silent = false\)/);
  assert.match(uiSource, /configuration and credentials are stored only on this DSH machine/);
  assert.match(uiSource, />Market card<\/button>/);
});

test('配置备份提供脱敏导出、快照预览与原子恢复入口', () => {
  assert.match(uiSource, /id="config-backup"[^>]*>Config backup<\/button>/);
  assert.match(uiSource, /call\('exportConfig'/);
  assert.match(uiSource, /call\('listSnapshots'/);
  assert.match(uiSource, /call\('createSnapshot'/);
  assert.match(uiSource, /call\('previewSnapshot'/);
  assert.match(uiSource, /call\('restoreSnapshot'/);
  assert.match(uiSource, /are never exported/);
  assert.match(uiSource, /If any Server fails during the restore, everything is rolled back/);
});

test('自定义和 JSON 连接可无中断修改显示名', () => {
  assert.match(uiSource, /const canRename = r\.canRename === true/);
  assert.match(uiSource, />Rename<\/button>/);
  assert.match(uiSource, /function openRenameConnection\(key\)/);
  assert.match(uiSource, /serverName \(tool prefix[^)]*\)/);
  assert.match(uiSource, /call\('renameConnection', \{ key, name \}\)/);
  assert.match(uiSource, /not interrupted/);
});

test('自定义和 JSON 连接可安全编辑完整配置并原子重连', () => {
  assert.match(uiSource, /const canEditConfiguration = r\.canEditConfiguration === true/);
  assert.match(uiSource, />Edit configuration<\/button>/);
  assert.match(uiSource, /function openConnectionEditor\(key\)/);
  assert.match(uiSource, /call\('editableConnectionConfig', \{ key \}\)/);
  assert.match(uiSource, /id="edit-connection-json"/);
  assert.match(uiSource, /&lt;KEEP_EXISTING&gt;/);
  assert.match(uiSource, /is the connection identity/);
  assert.match(uiSource, /call\('reconfigureConnection', \{ key, json \}\)/);
  assert.match(uiSource, /Any validation, launch, or save failure keeps the original connection/);
  assert.match(uiSource, /reconfigureConnection: 145_000/);
});

test('添加连接默认打开 JSON 且首屏操作按钮保持可见', () => {
  assert.match(uiSource, /function openAddConnection\(mode = 'json'/);
  assert.match(uiSource, /#add-connection'\)\.addEventListener\('click', \(\) => openAddConnection\('json'\)\)/);
  assert.ok(uiSource.indexOf('>Import JSON</button>') < uiSource.indexOf('>Manual setup</button>'));
  assert.match(uiSource, /id="import-json" rows="8"/);
  assert.match(uiSource, /\.modal \.m-actions \{[\s\S]*?position: sticky; bottom: 0;/);
});

test('手动配置支持 stdio 并区分 URL 与本地进程字段', () => {
  assert.match(uiSource, /<option value="stdio">stdio \(local process\)<\/option>/);
  assert.match(uiSource, /id="cfg-command"/);
  assert.match(uiSource, /id="cfg-args"/);
  assert.match(uiSource, /id="cfg-env"/);
  assert.match(uiSource, /function|syncTransportFields/);
  assert.match(uiSource, /transport === 'stdio' \? 'none' : authMode/);
  assert.match(uiSource, /stdio initialization, but this server currently has no tools to show/);
});

test('局域网明文 HTTP 需用户显式确认且告知限定范围', () => {
  assert.match(uiSource, /id="cfg-allow-insecure-lan" type="checkbox"/);
  assert.match(uiSource, /accept that HTTP traffic can be observed or tampered with on the same network segment/);
  assert.match(uiSource, /10\/8, 172\.16\/12, 192\.168\/16 and IPv6 ULA/);
  assert.match(uiSource, /allowInsecurePrivateNetwork: transport !== 'stdio'/);
  assert.match(uiSource, /private-network HTTP requires explicit confirmation/);
  assert.match(uiSource, /HTTP risk/);
});

test('连接、健康检查与工具加载均有有限超时和可重试提示', () => {
  assert.match(uiSource, /const API_TIMEOUTS = \{/);
  assert.match(uiSource, /connect: 145_000/);
  assert.match(uiSource, /toolsList: 20_000/);
  assert.match(uiSource, /healthCheck: 10_000/);
  assert.match(uiSource, /const controller = new AbortController\(\)/);
  assert.match(uiSource, /signal: controller\.signal/);
  assert.match(uiSource, /authMode === 'oauth2-pkce' \? 310_000/);
  assert.match(uiSource, /Request timed out \(\$\{Math\.ceil\(timeoutMs \/ 1000\)\} seconds\)/);
  assert.match(uiSource, /detailNeedsReconfigure = true/);
  assert.match(uiSource, /Check again/);
});

test('the page refreshes over same-origin SSE, and shows the last successful tool cache with parameter details when live data fails', () => {
  assert.match(uiSource, /new EventSource\('\/mcp-connector\/events'\)/);
  assert.match(uiSource, /source\.addEventListener\('status'/);
  assert.match(uiSource, /scheduleStatusRefresh/);
  assert.match(uiSource, /statusEventSource\?\.close\(\)/);
  assert.match(uiSource, /server\.cached/);
  assert.match(uiSource, /last successful cache/);
  assert.match(uiSource, /call\('toolDetail'/);
  assert.match(uiSource, /data-tool-detail=/);
  assert.match(uiSource, /schema has been safely truncated/);
});

test('凭据型市场卡片提供多 Server 一次配置表单', () => {
  assert.match(uiSource, /function openCatalogCredentialForm\(preset\)/);
  assert.match(uiSource, /Configure \$\{servers\.length\} MCP servers at once/);
  assert.match(uiSource, /preset\.credentialName/);
  assert.match(uiSource, /preset\.credentialPlaceholder/);
  assert.match(uiSource, /preset\.credentialDescription/);
  assert.match(uiSource, /preset\.credentialHelpLabel/);
  assert.match(uiSource, /preset\.credentialFields/);
  assert.match(uiSource, /data-credential-key=/);
  assert.match(uiSource, /field\.secret === false \? 'text' : 'password'/);
  assert.match(uiSource, /connectorId,\s*authMode,\s*credentialValues,\s*bearerToken/);
  assert.match(uiSource, /Local Agent · local files/);
  assert.match(uiSource, /Remote Agent · online/);
  assert.match(uiSource, /Online links and local files are enabled together/);
  assert.match(uiSource, /connectionComplete === false/);
  assert.match(uiSource, /completeSetup: 'Complete local parsing'/);
  assert.match(uiSource, /upgradeOauth: 'Upgrade to one-click auth'/);
  assert.match(uiSource, /incomplete && d\.authMode === 'oauth2-pkce'[\s\S]*?window\.__mcp\.connect/);
  assert.match(uiSource, /detailFailureState === 'incomplete' && detailConnector\?\.authMode === 'oauth2-pkce'/);
});

test('详情页的 Bearer/API Key 连接按钮直接打开凭据表单', () => {
  const trySource = uiSource.match(/\$\('#detail-try-btn'\)\.addEventListener\('click', async \(\) => \{[\s\S]*?\n  \}\);/)?.[0] ?? '';
  assert.match(trySource, /\['bearer', 'api-key'\]\.includes\(detailConnector\.authMode\)/);
  assert.match(trySource, /openAddConnection\('manual', detailConnector\)/);
  assert.ok(trySource.indexOf("openAddConnection('manual', detailConnector)") < trySource.indexOf("call('connect'"));
  assert.match(uiSource, /configureConnect: '🔑 Add credentials and connect'/);
  assert.match(uiSource, /showToast\(r\.message, true\); await refreshConnectionUi\(connectorId\)/);
  assert.match(uiSource, /Verifying credentials and the connection…/);
  assert.match(uiSource, /detailNeedsReconfigure[\s\S]*?reconfigureCredential/);
  assert.match(uiSource, /detailConnector\?\.connected\?\.length > 0 && !detailNeedsReconfigure/);
  assert.match(uiSource, /The current connection is abnormal/);
  assert.match(uiSource, /Authorization has expired/);
  assert.match(uiSource, /Check again/);
});

test('a successful connection reloads the open detail and tool list in place', () => {
  const connectSource = uiSource.match(/async connect\(connectorId\) \{[\s\S]*?\n    \},/)?.[0] ?? '';
  const configureSource = uiSource.match(/async submitConfig\(\) \{[\s\S]*?\n    \},\n    async submitImport/)?.[0] ?? '';
  const trySource = uiSource.match(/\$\('#detail-try-btn'\)\.addEventListener\('click', async \(\) => \{[\s\S]*?\n  \}\);/)?.[0] ?? '';
  assert.match(uiSource, /async function refreshConnectionUi\(connectorId\)/);
  assert.match(uiSource, /const reloadOpenDetail = isDetailOpenFor\(connectorId\)/);
  assert.match(uiSource, /detailLoadId !== openDetailLoadId/);
  assert.match(uiSource, /await window\.__mcp\.showDetail\(connectorId\)/);
  assert.match(connectSource, /await refreshConnectionUi\(connectorId\)/);
  assert.match(configureSource, /await refreshConnectionUi\(connectorId\)/);
  assert.match(trySource, /await refreshConnectionUi\(id\)/);
  assert.doesNotMatch(configureSource, /configuredFromDetail[\s\S]*?closeDetail\(\)/);
});

test('未连接且无工具快照的市场卡片不误报连接异常', () => {
  assert.match(uiSource, /if \(!d\.connected\?\.length && !d\.toolsSnapshot\?\.length\)/);
  assert.match(uiSource, /connectToUse/);
  assert.match(uiSource, /After connecting, the server tool list can be read/);
  assert.ok(
    uiSource.indexOf('if (!d.connected?.length && !d.toolsSnapshot?.length)') < uiSource.indexOf("call('toolsList', { connectorId, connectionKey: d.connectionKey, ...workspaceParams() })"),
  );
});

test('详情页提供连接、Server、Tool 三层策略预览、应用和回滚', () => {
  assert.match(uiSource, /id="connection-policy"/);
  assert.match(uiSource, /data-policy-scope=/);
  assert.match(uiSource, /data-server-name=/);
  assert.match(uiSource, /data-tool-name=/);
  assert.match(uiSource, /data-public-name=/);
  assert.match(uiSource, /Tool &gt; Server &gt; Connection/);
  assert.match(uiSource, /call\('previewPolicy'/);
  assert.match(uiSource, /expectedRevision: preview\.detail\.baseRevision/);
  assert.match(uiSource, /call\('applyPolicy'/);
  assert.match(uiSource, /call\('rollbackPolicy'/);
  assert.match(uiSource, /Host has not observed this tool, so it cannot be reported as disabled or healthy/);
});

test('新连接显示 project/global 目标，范围变更先预览影响再应用且可回滚', () => {
  assert.match(uiSource, /mcp-connector:workspace-context-request/);
  assert.match(clientSource, /mcp-connector:workspace-context/);
  assert.match(clientSource, /workspaceOptions: \(\) => availableWorkspaceContexts\(ctx\)/);
  assert.match(uiSource, /let availableWorkspaces = \[\]/);
  assert.match(uiSource, /function scopeFieldHtml/);
  assert.match(uiSource, /project:\$\{workspace\.workspaceId\}/);
  assert.match(uiSource, /any workspace; project scope is only visible to that workspace/);
  assert.match(uiSource, /All projects/);
  assert.match(uiSource, /function openConnectScope\(connectorId\)/);
  assert.match(uiSource, /call\('connect', \{ connectorId, \.\.\.scopeParams \}/);
  assert.match(uiSource, /call\('previewConnectionScope'/);
  assert.match(uiSource, /preview\.detail\.impact\?\.servers/);
  assert.match(uiSource, /expectedRevision: preview\.detail\.baseRevision/);
  assert.match(uiSource, /call\('applyConnectionScope'/);
  assert.match(uiSource, /call\('previewConnectionScopeRollback'/);
  assert.match(uiSource, /call\('rollbackConnectionScope'/);
  assert.match(uiSource, /scope binding never stores or copies credential/);
});

test('市场卡片区分状态未知、已连接、重新授权和连接异常', () => {
  const actionSource = uiSource.match(/function actionHtml\(d\) \{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.match(actionSource, /state === 'healthy'[\s\S]*?t\('connected'\)/);
  assert.match(actionSource, /state === 'unknown'[\s\S]*?t\('unknown'\)/);
  assert.match(actionSource, /state === 'reauth'[\s\S]*?t\('reauthorize'\)/);
  assert.match(actionSource, /state === 'recovering'[\s\S]*?t\('recovering'\)/);
  assert.match(actionSource, /state === 'unavailable'[\s\S]*?t\('connectionError'\)/);
  assert.match(uiSource, /call\('healthCheck', \{\}\)/);
});

test('已安装列表和详情展示可解释诊断与最近成功时间', () => {
  assert.match(uiSource, /r\.diagnostic\.stageLabel \|\| r\.diagnostic\.stage/);
  assert.match(uiSource, /r\.diagnostic\.code/);
  assert.match(uiSource, /Suggestion:/);
  assert.match(uiSource, /r\.lastSuccessfulAt/);
  assert.match(uiSource, /detailFailureState === 'unknown' \? 'Tool status unknown'/);
  assert.match(uiSource, /Status not yet confirmed/);
});

test('市场只保留推荐与业务分类筛选', () => {
  assert.match(uiSource, /aria-label="Market categories"/);
  assert.match(uiSource, /items\.filter\(matchesMarketFilters\)/);
  assert.doesNotMatch(uiSource, /marketVendor|marketAuth|AUTH_FILTERS/);
  assert.doesNotMatch(uiSource, /market-vendor-filter|data-auth-filter|market-filter-reset/);
  assert.doesNotMatch(uiSource, /服务商<\/span>|接入方式<\/span>|全部服务商|全部接入|Key \/ Token|免密/);
});

test('the market supports category filtering and a featured section (9 categories + featured)', () => {
  assert.match(uiSource, /const CATEGORIES = \[/);
  assert.match(uiSource, /value: 'recommended', label: 'Recommended'/);
  // Category values stay in the catalog's original Chinese keys, but every user-facing label is English.
  for (const [category, label] of [
    ['企业数据', 'Enterprise Data'],
    ['金融投资', 'Finance & Investment'],
    ['法律合规', 'Legal & Compliance'],
    ['开发工具', 'Developer Tools'],
    ['办公协作', 'Office & Collaboration'],
    ['调研分析', 'Research & Analysis'],
    ['设计创意', 'Design & Creative'],
    ['效率工具', 'Productivity'],
    ['其他', 'Other'],
  ]) {
    assert.match(uiSource, new RegExp(`value: '${category}', label: '${label}'`));
  }
  assert.match(uiSource, /function normalizeCategory\(c\)/);
  assert.match(uiSource, /CATEGORY_MAP\[c\] \|\| '其他'/);
  assert.match(uiSource, /marketCategory === 'recommended' && !d\.featured/);
  assert.match(uiSource, /normalizeCategory\(d\.category\) !== marketCategory/);
  assert.match(uiSource, /data-category-filter=/);
  assert.match(uiSource, /\.category-chips/);
  assert.match(uiSource, /let marketCategory = '';/);
});

test('全部市场按分类分章节，每章默认展示 4 个并可展开', () => {
  assert.match(uiSource, /const MARKET_SECTION_PREVIEW_LIMIT = 4;/);
  assert.match(uiSource, /function groupedMarketHtml\(items\)/);
  assert.match(uiSource, /value: 'recommended', label: 'Recommended', items:/);
  assert.match(uiSource, /items\.slice\(0, MARKET_SECTION_PREVIEW_LIMIT\)/);
  assert.match(uiSource, /data-section-toggle=/);
  assert.match(uiSource, /View all \$\{items\.length\}/);
  assert.match(uiSource, /filtered\.map\(cardHtml\)/, '点击分类后应展示该分类全部卡片');
  assert.doesNotMatch(uiSource, /catalogRenderLimit|id="catalog-more"/);
});

test('市场分类栏位于固定头部且不会覆盖卡片，桌面单行无横向滚动', () => {
  const headerSource = uiSource.match(/<header>[\s\S]*?<\/header>/)?.[0] ?? '';
  assert.match(headerSource, /id="market-nav"/);
  assert.match(uiSource, /\.market-nav \{[^}]*flex: 0 0 100%;[^}]*order: 4;/);
  assert.match(uiSource, /\.market-filters \{[^}]*position: static;/);
  assert.doesNotMatch(uiSource, /\.market-filters \{[^}]*position: sticky;/);
  assert.match(uiSource, /#market-nav'\)\.addEventListener\('click'/);
  assert.match(uiSource, /\.category-chips \{[^}]*flex-wrap: nowrap;[^}]*overflow: visible;/);
  assert.match(uiSource, /@media \(max-width: 620px\) \{[\s\S]*?\.category-chips \{ flex-wrap: wrap; \}/);
  assert.doesNotMatch(uiSource, /\.category-chips \{[^}]*overflow-x: auto;/);
});

test('市场总数移入页签且正文不再显示冗余操作提示', () => {
  assert.match(uiSource, /id="market-tab-count"/);
  assert.match(uiSource, /id="installed-tab-count"/);
  assert.match(uiSource, /setTabCount\('market', items\.length\)/);
  assert.match(uiSource, /setTabCount\('installed', items\.length\)/);
  assert.doesNotMatch(uiSource, /点击卡片查看能力，点击「连接」完成授权/);
});

test('0 条连接时不显示社区入口', () => {
  const loadInstalledSource = uiSource.match(/async function loadInstalled\(\) \{[\s\S]*?\n  \}/)?.[0] ?? '';
  const emptyState = loadInstalledSource.indexOf('if (!items.length)');
  const eligibility = loadInstalledSource.indexOf('markCommunityCtaEligible();');
  assert.ok(emptyState >= 0 && eligibility > emptyState, '空状态必须在 CTA 资格标记之前返回');
  assert.match(uiSource, /if \(!communityCtaEligible \|\| communityCtaDismissed\) return '';/);
});

test('连接、配置、导入或 URL 安装成功后显示克制的社区入口', () => {
  const connectSource = uiSource.match(/async connect\(connectorId\) \{[\s\S]*?\n    \},/)?.[0] ?? '';
  const configureSource = uiSource.match(/async submitConfig\(\) \{[\s\S]*?\n    \},\n    async submitImport/)?.[0] ?? '';
  const importSource = uiSource.match(/async submitImport\(\) \{[\s\S]*?\n    \},\n    async submitUrl/)?.[0] ?? '';
  const installFromUrlSource = uiSource.match(/async submitUrl\(\) \{[\s\S]*?\n    \},\n    async migrateLegacy/)?.[0] ?? '';
  assert.match(uiSource, /function communityCtaHtml\(\)/);
  assert.match(uiSource, /function markCommunityCtaEligible\(\)/);
  assert.match(uiSource, /Connecting well\? If MCP Connector helps you/);
  assert.match(uiSource, />Star<\/a>/);
  assert.match(uiSource, />Submit a connector<\/a>/);
  assert.match(uiSource, />Contribute<\/a>/);
  assert.match(uiSource, /\$\{communityCtaHtml\(\)\}/);
  assert.match(connectSource, /if \(r\.ok\) \{\s*markCommunityCtaEligible\(\);/);
  assert.equal((configureSource.match(/call\('configure'/g) || []).length, 2, '市场配置和自定义配置都必须受测');
  assert.equal((configureSource.match(/markCommunityCtaEligible\(\);/g) || []).length, 2, '两种配置成功后都应显示 CTA');
  assert.match(importSource, /call\('importJson'[\s\S]*?if \(!r\.ok\)[\s\S]*?markCommunityCtaEligible\(\);/);
  assert.match(installFromUrlSource, /call\('installFromUrl'[\s\S]*?if \(!r\.ok\)[\s\S]*?markCommunityCtaEligible\(\);/);
  assert.doesNotMatch(uiSource, /openModal\([^\n]*连接顺利/);
});

test('关闭社区入口后在本次页面生命周期内保持隐藏', () => {
  assert.match(uiSource, /let communityCtaDismissed = false;/);
  assert.match(uiSource, /onclick="window\.__mcp\.dismissCommunityCta\(\)"/);
  assert.match(uiSource, /function dismissCommunityCta\(\) \{[\s\S]*?communityCtaDismissed = true;[\s\S]*?communityCtaEligible = false;[\s\S]*?querySelector\('\.community-cta'\)\?\.remove\(\);/);
  assert.match(uiSource, /dismissCommunityCta\(\) \{ dismissCommunityCta\(\); \}/);
});

test('the tool list uses English counts and flags provider-deprecated tools', () => {
  assert.match(uiSource, /\$\('#tools-summary'\)\.textContent = `\$\{detailToolServers\.length\} servers · \$\{totalTools\} tools`/);
  assert.match(uiSource, /function isDeprecatedTool\(tool\)/);
  assert.match(uiSource, /deprecated/);
  assert.match(uiSource, /已弃用\|已废弃\|不再推荐/);
  assert.match(uiSource, /<span class="tool-deprecated">Deprecated<\/span>/);
  assert.match(uiSource, /Number\(isDeprecatedTool\(left\)\) - Number\(isDeprecatedTool\(right\)\)/);
});
