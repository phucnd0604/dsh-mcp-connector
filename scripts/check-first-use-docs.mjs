#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const PATHS = {
  readme: 'README.md',
  userGuide: 'docs/USER-GUIDE.md',
  growth: 'docs/GROWTH-BASELINE.md',
  entry: 'docs/tutorials/README.md',
  json: 'docs/tutorials/JSON-MIGRATION.md',
  oauth: 'docs/tutorials/OAUTH-DIAGNOSTICS.md',
  tools: 'docs/tutorials/TOOL-SEARCH-RECOVERY.md',
  scenarios: 'docs/tutorials/FIRST-SUCCESS-SCENARIOS.md',
  statusCopy: 'docs/tutorials/TRUSTED-STATUS-COPY.md',
  publicationDrafts: 'marketing/campaign-0.2.59/P1-SCENARIO-PUBLICATION-DRAFTS.md',
};

function requireText(path, text, expected) {
  if (!text.includes(expected)) throw new Error(`${path}: missing ${expected}`);
}

export async function checkFirstUseDocs() {
  const entries = await Promise.all(Object.entries(PATHS).map(async ([key, path]) => [key, await readFile(path, 'utf8')]));
  const docs = Object.fromEntries(entries);

  requireText(PATHS.readme, docs.readme, '(docs/tutorials/README.md)');
  requireText(PATHS.userGuide, docs.userGuide, '(tutorials/README.md)');

  for (const link of ['(JSON-MIGRATION.md)', '(OAUTH-DIAGNOSTICS.md)', '(TOOL-SEARCH-RECOVERY.md)']) {
    requireText(PATHS.entry, docs.entry, link);
  }
  for (const link of ['(FIRST-SUCCESS-SCENARIOS.md)', '(TRUSTED-STATUS-COPY.md)']) {
    requireText(PATHS.entry, docs.entry, link);
    requireText(PATHS.readme, docs.readme, `docs/tutorials/${link.slice(1)}`);
  }
  requireText(PATHS.userGuide, docs.userGuide, '(tutorials/FIRST-SUCCESS-SCENARIOS.md)');
  requireText(PATHS.userGuide, docs.userGuide, '(tutorials/TRUSTED-STATUS-COPY.md)');
  for (const expected of [
    'dsh plugin --profile web add dsh-mcp-connector',
    'DSH Desktop and `dsh web` both load the plugin from the local `web` profile',
    'do not switch the command to `--profile desktop` just because you are using Desktop',
    'Settings → Plugins → Plugin configuration → MCP Connector',
    'mcp__<serverName>__<toolName>',
    'read-only call',
    'DSH Host',
    'permission',
    'cost',
    'no data / pending acceptance',
    'https://github.com/duhu2000/dsh-mcp-connector/stargazers',
    'https://github.com/duhu2000/dsh-mcp-connector-registry/blob/main/docs/ONBOARDING.md',
    '../../CONTRIBUTING.md',
  ]) {
    requireText(PATHS.entry, docs.entry, expected);
  }

  for (const [key, path] of [['json', PATHS.json], ['oauth', PATHS.oauth], ['tools', PATHS.tools]]) {
    requireText(path, docs[key], '(README.md)');
  }

  for (const expected of [
    'Read-only company information lookup',
    'Local intelligent document parsing',
    'Authorized office document or schedule lookup',
    'Local process + remote processing',
    'no evidence / pending user acceptance',
    '(TRUSTED-STATUS-COPY.md)',
  ]) {
    requireText(PATHS.scenarios, docs.scenarios, expected);
  }

  for (const expected of [
    'Account/organization: the current connection cannot confirm this',
    'Authorization status unknown',
    'Host registration status unknown',
    'Invocation: no evidence / pending acceptance',
    'Administrator prerequisites: pending service provider confirmation',
    'Local process + remote processing',
    "This run's cost: the plugin cannot confirm it",
    'Checked at: YYYY-MM-DD HH:mm:ss ±HH:mm',
    'The cached parameter structure has changed and may affect existing invocations; verify the parameters before use, and re-confirm as the Host requires.',
    'Schema is incomplete or has no history, so compatibility cannot be determined.',
    'Discovery cache only; invocation: no evidence / pending acceptance.',
    'Schema change: tool removal, newly required parameters, narrowed types/enums or other incompatible differences detected;',
    'The current schema cannot be confirmed;',
    'Tool side effects: the service did not provide them, or the Host did not pass a reliable marker; read-only behaviour cannot be concluded from this.',
    'do not add covert user tracking for copy',
  ]) {
    requireText(PATHS.statusCopy, docs.statusCopy, expected);
  }

  for (const expected of [
    'Local/repository draft only',
    'do not publish publicly automatically',
    'MCP Connector, MCP Server, connection management, cross-connection tool search, connection troubleshooting',
    '2026-10-02',
    '2026-10-09',
    'Do not infer connections or first calls from download counts',
  ]) {
    requireText(PATHS.publicationDrafts, docs.publicationDrafts, expected);
  }

  for (const expected of [
    '## 7/14-day first-use review template',
    'DSH Market/search impressions | No data',
    'First successful read-only calls | No data',
    'Do not calculate an exposure-to-install, download-to-connection, or download-to-first-call conversion rate',
    '### 0.2.59 scheduled first-use checkpoints',
    'T+7 = 2026-10-02',
    'T+14 = 2026-10-09',
    'Fill only after due date',
  ]) {
    requireText(PATHS.growth, docs.growth, expected);
  }

  return PATHS.entry;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  checkFirstUseDocs().then((path) => {
    console.log(`First-use docs check passed: ${path}`);
  }).catch((error) => {
    console.error(`First-use docs check failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
