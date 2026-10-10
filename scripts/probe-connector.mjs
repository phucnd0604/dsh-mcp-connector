#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { probeConnector, validateRegistryDescriptors } from '../lib/probe.js';

function usage() {
  console.log(`Usage: dsh-mcp-connector-probe <catalog-or-connector.json> [options]

Options:
  --validate-only       Only run Schema, uniqueness, URL and secret audits
  --timeout <ms>        Per-request network timeout (default 15000)
  --output <file>       Write the JSON report to a file
  --allow-partial       Do not exit non-zero when the result is partial
  --help                Show this help`);
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0) {
  usage();
  process.exit(args.length === 0 ? 1 : 0);
}

let input;
let output;
let timeoutMs = 15_000;
let validateOnly = false;
let allowPartial = false;
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--validate-only') validateOnly = true;
  else if (arg === '--allow-partial') allowPartial = true;
  else if (arg === '--timeout') timeoutMs = Number(args[++i]);
  else if (arg === '--output') output = args[++i];
  else if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
  else if (!input) input = arg;
  else throw new Error(`Unexpected argument: ${arg}`);
}
if (!input) throw new Error('Missing connector/catalog JSON file');
if (!Number.isFinite(timeoutMs) || timeoutMs < 100) throw new Error('--timeout must be a number no less than 100');

const raw = JSON.parse(await readFile(input, 'utf8'));
const list = Array.isArray(raw) ? raw : Array.isArray(raw?.connectors) ? raw.connectors : [raw];
const descriptors = validateRegistryDescriptors(list);
let report;
if (validateOnly) {
  report = {
    ok: true,
    mode: 'validate-only',
    checkedAt: Date.now(),
    connectors: descriptors.map((descriptor) => ({
      id: descriptor.id,
      servers: descriptor.servers.length,
      authMode: descriptor.auth.mode,
    })),
  };
} else {
  const results = [];
  for (const descriptor of descriptors) results.push(await probeConnector(descriptor, { timeoutMs }));
  report = {
    ok: results.every((result) => result.status === 'pass' || (allowPartial && result.status === 'partial')),
    mode: 'probe',
    checkedAt: Date.now(),
    results,
  };
}

const json = `${JSON.stringify(report, null, 2)}\n`;
if (output) await writeFile(output, json, { mode: 0o600 });
else process.stdout.write(json);
if (!report.ok) process.exitCode = 1;
