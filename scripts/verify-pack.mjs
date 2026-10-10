/**
 * Pre-release validation of the npm package contents, so tests, design mockups,
 * workflows or local files can never be published by accident.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const WHITELIST = [
  /^package\.json$/,
  /^cordis\.patch\.yml$/,
  /^README\.md$/,
  /^README\.en\.md$/,
  /^screenshots\.json$/,
  /^CONTRIBUTING\.md$/,
  /^CHANGELOG\.md$/,
  /^LICENSE$/,
  /^install\.sh$/,
  /^catalog\/[^/]+\.json$/,
  /^lib\/[^/]+\.js$/,
  /^lib\/connectors\/[^/]+\.js$/,
  /^scripts\/(?:probe-connector|build-registry|cli-bridge|ui-harness)\.mjs$/,
  /^registry\/README\.md$/,
  /^registry\/catalog\.json$/,
  /^registry\/connectors\/[^/]+\.json$/,
  /^registry\/schema\/[^/]+\.json$/,
  /^docs\/(?:CLI-PROVIDERS|CONFIG-BACKUP|CONNECTION-SCOPES|DESKTOP-E2E|FIRST-CONTRIBUTION|MARKET-REGISTRATION|PLUGIN-UPDATE|SESSION-TOOL-INJECTION|STDIO-SUPPORT|TOOL-GOVERNANCE|USER-GUIDE)\.md$/,
  /^docs\/tutorials\/(?:README|FIRST-SUCCESS-SCENARIOS|JSON-MIGRATION|OAUTH-DIAGNOSTICS|TOOL-SEARCH-RECOVERY|TRUSTED-STATUS-COPY)\.md$/,
  /^docs\/screenshots\/(?:README\.md|assets\.json|[^/]+\.(?:gif|jpe?g|png|svg|webp))$/,
  /^ui\/index\.html$/,
  /^ui\/assets\/[^/]+\.(?:svg|png|webp)$/,
];

let raw;
try {
  const npmCli = process.env.npm_execpath;
  const command = npmCli ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
  const args = npmCli
    ? [npmCli, 'pack', '--dry-run', '--json']
    : ['pack', '--dry-run', '--json'];
  raw = execFileSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (error) {
  console.error('verify-pack failed: `npm pack --dry-run --json` exited with an error');
  console.error(String(error.stderr ?? error.message));
  process.exit(1);
}

const [pack] = JSON.parse(raw);
if (!pack || !Array.isArray(pack.files)) {
  console.error('verify-pack failed: could not parse the npm pack output');
  process.exit(1);
}

const files = pack.files.map((file) => file.path).sort();
const requiredTutorials = [
  'docs/tutorials/README.md',
  'docs/tutorials/FIRST-SUCCESS-SCENARIOS.md',
  'docs/tutorials/JSON-MIGRATION.md',
  'docs/tutorials/OAUTH-DIAGNOSTICS.md',
  'docs/tutorials/TOOL-SEARCH-RECOVERY.md',
  'docs/tutorials/TRUSTED-STATUS-COPY.md',
];
const missingTutorials = requiredTutorials.filter((file) => !files.includes(file));
if (missingTutorials.length > 0) {
  console.error('verify-pack failed: the task tutorials linked from the README are missing from the npm package:');
  for (const file of missingTutorials) console.error(`  - ${file}`);
  process.exit(1);
}
const stray = files.filter((file) => !WHITELIST.some((rule) => rule.test(file)));
if (stray.length > 0) {
  console.error('verify-pack failed: the following files must not be included in the published npm package:');
  for (const file of stray) console.error(`  - ${file}`);
  process.exit(1);
}

const sensitivePatterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['npm token', /npm_[A-Za-z0-9]{20,}/],
  ['GitHub token', /gh[pousr]_[A-Za-z0-9]{20,}/],
  ['OpenAI-style key', /sk-[A-Za-z0-9_-]{20,}/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['local absolute path', /(?:\/Users\/[^/\s]+\/|\/home\/[^/\s]+\/)/],
];
const sensitive = [];
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  for (const [label, pattern] of sensitivePatterns) {
    if (pattern.test(content)) sensitive.push(`${file}: ${label}`);
  }
}
if (sensitive.length > 0) {
  console.error('verify-pack failed: published files appear to contain credentials or local machine information:');
  for (const item of sensitive) console.error(`  - ${item}`);
  process.exit(1);
}

const installScript = readFileSync('install.sh', 'utf8');
if (!/^PKG="dsh-mcp-connector"$/m.test(installScript)) {
  console.error('verify-pack failed: install.sh does not install dsh-mcp-connector');
  process.exit(1);
}

console.log(`verify-pack passed: all ${files.length} published files are whitelisted, and no credentials or local machine paths were found`);
