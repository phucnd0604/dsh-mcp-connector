import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHealthSummary } from '../lib/diagnostics.js';

const record = {
  key: 'demo-main',
  connectorId: 'demo',
  serverKey: 'main',
  serverName: 'demo',
  enabled: true,
};

test('Returns unknown honestly when there is no proactive check result', () => {
  const summary = buildHealthSummary({
    connectorId: 'demo', records: [record], results: [], checkedAt: null,
  });
  assert.equal(summary.connectionState, 'unknown');
  assert.equal(summary.label, 'Status unknown');
  assert.equal(summary.checkedAt, null);
  assert.equal(summary.lastSuccessfulAt, null);
  assert.deepEqual(summary.diagnostic, {
    state: 'unknown',
    stage: 'host-observation',
    stageLabel: 'Host status observation',
    code: 'not-checked',
    message: 'The configuration is saved, but this process has not observed an availability check result yet',
    action: 'Run the health check to confirm the connection status',
    checkedAt: null,
    lastSuccessfulAt: null,
  });
});

test('Stays unknown when the Host cannot confirm the stdio registration status', () => {
  const summary = buildHealthSummary({
    connectorId: 'demo',
    records: [record],
    results: [{
      ok: true,
      kind: 'managed',
      code: 'host-status-unavailable',
      serverKey: 'main',
      serverName: 'demo',
      message: '当前 Host 无法读取 stdio 工具注册状态',
    }],
    checkedAt: 200,
  });
  assert.equal(summary.connectionState, 'unknown');
  assert.equal(summary.diagnostic.stage, 'host-observation');
  assert.equal(summary.diagnostic.code, 'host-status-unavailable');
  assert.match(summary.diagnostic.action, /upgrade|restart/i);
});

test('Failure diagnostics carry the stage, stable code, guidance and keep the last successful time', () => {
  const healthy = buildHealthSummary({
    connectorId: 'demo',
    records: [record],
    results: [{ ok: true, kind: 'connected', serverKey: 'main', serverName: 'demo' }],
    checkedAt: 100,
  });
  const failed = buildHealthSummary({
    connectorId: 'demo',
    records: [record],
    results: [{ ok: false, kind: 'auth', serverKey: 'main', serverName: 'demo', message: 'HTTP 401' }],
    checkedAt: 200,
    previous: healthy,
  });
  assert.equal(failed.connectionState, 'reauth');
  assert.equal(failed.lastSuccessfulAt, 100);
  assert.equal(failed.diagnostic.stage, 'authentication');
  assert.equal(failed.diagnostic.code, 'auth');
  assert.equal(failed.diagnostic.lastSuccessfulAt, 100);
  assert.match(failed.diagnostic.action, /Reauthorize or update the credentials/);
  assert.equal(failed.results[0].diagnostic.lastSuccessfulAt, 100);
});

test('The summary is degraded when several Servers have both successes and failures', () => {
  const second = { ...record, key: 'demo-second', serverKey: 'second', serverName: 'demo-second' };
  const summary = buildHealthSummary({
    connectorId: 'demo',
    records: [record, second],
    results: [
      { ok: true, kind: 'connected', serverKey: 'main', serverName: 'demo' },
      { ok: false, kind: 'dns', serverKey: 'second', serverName: 'demo-second', message: '域名解析失败' },
    ],
    checkedAt: 300,
  });
  assert.equal(summary.connectionState, 'degraded');
  assert.equal(summary.availableServers, 1);
  assert.equal(summary.failedServers, 1);
  assert.equal(summary.lastSuccessfulAt, 300);
  assert.equal(summary.diagnostic.code, 'dns');
});
