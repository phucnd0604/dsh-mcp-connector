/**
 * Connection health summary and explainable diagnostics.
 *
 * Diagnostics only describe the state the plugin actually observed. Without an active check
 * result, or when the Host cannot report stdio registration status, the state is always unknown; a saved configuration is never passed off as usable.
 */

export const CONNECTION_STATE_LABELS = Object.freeze({
  disconnected: 'Not connected',
  unknown: 'Status unknown',
  configured: 'Configured', // Kept only for backward compatibility with older results; new summaries no longer produce this state.
  disabled: 'Disabled',
  healthy: 'Connected',
  degraded: 'Partially degraded',
  reauth: 'Reauthorization required',
  recovering: 'Auto-retrying',
  unavailable: 'Connection error',
});

const STAGE_LABELS = Object.freeze({
  configuration: 'Configuration',
  authentication: 'Authentication',
  transport: 'Network and transport',
  'mcp-initialize': 'MCP initialization',
  'host-startup': 'Host startup',
  'host-observation': 'Host status observation',
  'tool-discovery': 'Tool discovery',
  ready: 'Availability confirmed',
});

const FAILURE_GUIDANCE = Object.freeze({
  auth: ['authentication', 'Reauthorize or update the credentials, then run the health check again'],
  refresh: ['authentication', 'Wait for the automatic retry; if it keeps failing, check the network and the OAuth service status'],
  conflict: ['configuration', 'Disable the conflicting legacy plugin or complete the authorization migration, then retry'],
  'rate-limit': ['transport', 'Wait for the server rate-limit window to end, then retry'],
  dns: ['transport', 'Check the DNS, the proxy and the current network, then retry'],
  tls: ['transport', 'Check the certificate, the VPN/dedicated line and the source IP allowlist, then retry'],
  refused: ['transport', 'Check the MCP URL and the target service status, then retry'],
  timeout: ['transport', 'Check the network, the service status and the timeout settings, then retry'],
  http: ['transport', 'Check the MCP URL, the service status and the access policy, then retry'],
  network: ['transport', 'Check the network and the MCP URL, then retry'],
  protocol: ['mcp-initialize', 'Confirm the URL points at a compatible MCP Streamable HTTP endpoint'],
  startup: ['host-startup', 'Check the Host logs, the launch command, the arguments and the runtime environment, then retry'],
  'process-not-found': ['host-startup', 'Install the required runtime or fix the stdio command, then retry'],
  'process-exit': ['host-startup', 'Check the process exit code, the arguments, the environment variables and the Host logs'],
  'host-version': ['host-observation', 'Upgrade the DSH Host and check again'],
  'host-tools-pending': ['host-observation', 'Review the Host logs and check again; it stays unknown until availability is confirmed'],
  'host-status-unavailable': ['host-observation', 'Upgrade or restart the DSH Host, then check again once the registration status is visible'],
  'host-status-error': ['host-observation', 'Review the Host logs and check the tool registration status again'],
  'tool-list': ['tool-discovery', 'Check the server tool permissions and the service status, then retry'],
});

function resultId(result) {
  return result?.serverKey || result?.serverName || '';
}

function previousResult(previous, result) {
  const id = resultId(result);
  if (!id) return undefined;
  return previous?.results?.find((item) => resultId(item) === id);
}

function failureState(kind) {
  if (kind === 'auth') return 'reauth';
  if (kind === 'refresh') return 'recovering';
  return 'unavailable';
}

function resultDiagnostic(result, checkedAt, previous) {
  const earlier = previousResult(previous, result)?.diagnostic;
  if (result.ok && result.kind !== 'managed') {
    return {
      state: 'healthy',
      stage: result.stage || (result.kind === 'connected' ? 'ready' : 'tool-discovery'),
      stageLabel: STAGE_LABELS[result.stage || (result.kind === 'connected' ? 'ready' : 'tool-discovery')],
      code: result.code || 'ok',
      message: result.message || 'The most recent availability check passed',
      action: 'No action needed',
      checkedAt,
      lastSuccessfulAt: checkedAt,
    };
  }

  if (result.ok && result.kind === 'managed') {
    const code = result.code || 'host-status-unavailable';
    const [stage, action] = FAILURE_GUIDANCE[code] || FAILURE_GUIDANCE['host-status-unavailable'];
    return {
      state: 'unknown',
      stage,
      stageLabel: STAGE_LABELS[stage],
      code,
      message: result.message || 'The tool registration status of the stdio Server cannot be confirmed by the Host right now',
      action,
      checkedAt,
      lastSuccessfulAt: earlier?.lastSuccessfulAt ?? null,
    };
  }

  const code = result.code || result.kind || 'network';
  const [stage, action] = FAILURE_GUIDANCE[code] || FAILURE_GUIDANCE.network;
  return {
    state: failureState(result.kind),
    stage,
    stageLabel: STAGE_LABELS[stage],
    code,
    message: result.message || 'The connection check did not pass',
    action,
    checkedAt,
    lastSuccessfulAt: earlier?.lastSuccessfulAt ?? null,
  };
}

function emptyDiagnostic(connectionState, checkedAt, previous) {
  const values = {
    disconnected: ['configuration', 'not-configured', 'No connection has been saved yet', 'Connect or configure this connector, then check again'],
    disabled: ['configuration', 'disabled', 'The connection is disabled, so no availability check was run', 'Enable the connection and then run the health check'],
    unknown: ['host-observation', 'not-checked', 'The configuration is saved, but this process has not observed an availability check result yet', 'Run the health check to confirm the connection status'],
  };
  const [stage, code, message, action] = values[connectionState] || values.unknown;
  return {
    state: connectionState,
    stage,
    stageLabel: STAGE_LABELS[stage],
    code,
    message,
    action,
    checkedAt,
    lastSuccessfulAt: previous?.lastSuccessfulAt ?? null,
  };
}

/**
 * @param {{ connectorId: string, records: object[], results: object[], checkedAt?: number|null, previous?: object|null }} input
 */
export function buildHealthSummary({ connectorId, records, results, checkedAt = Date.now(), previous = null }) {
  const enabledRecords = records.filter((record) => record.enabled !== false);
  const normalizedResults = results.map((result) => ({
    ...result,
    diagnostic: resultDiagnostic(result, checkedAt, previous),
  }));
  const availableServers = normalizedResults.filter((result) => result.ok && result.kind !== 'managed').length;
  const pendingServers = normalizedResults.filter((result) => result.ok && result.kind === 'managed').length;
  const failedServers = normalizedResults.filter((result) => !result.ok).length;
  const authFailures = normalizedResults.filter((result) => !result.ok && result.kind === 'auth').length;
  const refreshFailures = normalizedResults.filter((result) => !result.ok && result.kind === 'refresh').length;

  let connectionState = 'unknown';
  if (records.length === 0) connectionState = 'disconnected';
  else if (enabledRecords.length === 0) connectionState = 'disabled';
  else if (failedServers === 0 && pendingServers === 0 && availableServers > 0) connectionState = 'healthy';
  else if (availableServers > 0 && (failedServers > 0 || pendingServers > 0)) connectionState = 'degraded';
  else if (pendingServers > 0 && failedServers === 0) connectionState = 'unknown';
  else if (authFailures > 0) connectionState = 'reauth';
  else if (refreshFailures > 0) connectionState = 'recovering';
  else if (failedServers > 0) connectionState = 'unavailable';

  const lastSuccessfulAt = availableServers > 0 ? checkedAt : previous?.lastSuccessfulAt ?? null;
  let diagnostic;
  if (normalizedResults.length === 0) {
    diagnostic = emptyDiagnostic(connectionState, checkedAt, previous);
  } else if (connectionState === 'healthy') {
    diagnostic = { ...normalizedResults[0].diagnostic, state: 'healthy', lastSuccessfulAt };
  } else {
    const representative = normalizedResults.find((result) => !result.ok)
      || normalizedResults.find((result) => result.kind === 'managed')
      || normalizedResults[0];
    diagnostic = {
      ...representative.diagnostic,
      state: connectionState,
      lastSuccessfulAt,
    };
  }

  return {
    connectorId,
    connectionState,
    label: CONNECTION_STATE_LABELS[connectionState],
    configuredServers: records.length,
    enabledServers: enabledRecords.length,
    availableServers,
    pendingServers,
    failedServers,
    checkedAt,
    lastSuccessfulAt,
    diagnostic,
    results: normalizedResults,
  };
}

export function diagnosticForRecord(summary, result) {
  return result?.diagnostic ?? summary?.diagnostic ?? null;
}
