/**
  * Channel one: one-click OAuth authorization (generic Authorization Code + PKCE S256 + DCR).
  * Runs the whole flow and hands the result to index.js to persist, mount the mcp-client entries and schedule a refresh.
 */
import {
  discoverProtectedResource,
  discoverServerMetadata,
  registerClient,
  pkcePair,
  generateState,
  buildAuthorizeUrl,
  exchangeCode,
  extractTokenResources,
} from '../oauth.js';
import { startCallbackServer } from '../callback-server.js';
import { openBrowser } from '../util.js';

const OAUTH_STAGE_LABELS = Object.freeze({
    'resource-discovery': 'Protected resource discovery',
    'server-metadata': 'OAuth server discovery',
    'callback-listener': 'Local callback listener',
    'client-registration': 'OAuth client registration',
    'authorization-callback': 'Browser authorization callback',
    'token-exchange': 'OAuth token exchange',
});

async function atOAuthStage(stage, action) {
  try {
    return await action();
  } catch (error) {
    if (error && typeof error === 'object' && !error.oauthStage) {
      error.oauthStage = stage;
      error.oauthStageLabel = OAUTH_STAGE_LABELS[stage] ?? stage;
    }
    throw error;
  }
}

function stagedError(stage, message) {
  const error = new Error(message);
  error.oauthStage = stage;
  error.oauthStageLabel = OAUTH_STAGE_LABELS[stage] ?? stage;
  return error;
}

/** Collapse low-level OAuth exceptions into actionable user diagnostics that do not leak the response body. */
export function describeOAuthAuthorizationError(error) {
  const stage = error?.oauthStage ?? 'unknown';
    const stageLabel = error?.oauthStageLabel ?? OAUTH_STAGE_LABELS[stage] ?? 'OAuth authorization';
  const httpStatus = Number.isInteger(error?.httpStatus) ? error.httpStatus : undefined;
  const upstreamCode = typeof error?.code === 'string' ? error.code : undefined;
  if (stage === 'client-registration' && httpStatus === 403) {
    return {
            message: 'OAuth client registration was rejected by the service provider (HTTP 403) before browser authorization started. The service may only allow reviewed clients; check the provider documentation for MCP client access, or wait until the connector completes its official registration.',
      detail: {
        kind: 'oauth-client-registration-rejected',
        stage,
        stageLabel,
        code: 'oauth-dcr-forbidden',
        httpStatus,
        upstreamCode,
      },
    };
  }
  const safeReason = httpStatus
        ? (upstreamCode && upstreamCode !== 'http_error' ? upstreamCode : 'the service provider rejected the request')
        : String(error?.message ?? 'unknown error')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .slice(0, 240);
  return {
        message: `${stageLabel} failed${httpStatus ? ` (HTTP ${httpStatus})` : ''}: ${safeReason}`,
    detail: {
      kind: 'oauth-authorization',
      stage,
      stageLabel,
      code: upstreamCode ?? 'oauth-error',
      ...(httpStatus ? { httpStatus } : {}),
    },
  };
}

/**
 * @param {object} args
  * @param {object} args.connector the normalized connector descriptor (auth.mode = oauth2-pkce)
  * @param {object} args.config the plugin configuration
 * @param {{info:Function,warn:Function,error:Function}} args.logger
 * @param {AbortSignal} [args.signal]
 */
export async function oauthAuthorize({ connector, config, logger, signal }) {
  const entryServer = connector.servers.find((server) => server.url);
  if (!entryServer) throw stagedError('resource-discovery', `connector "${connector.id}" has no HTTP OAuth resource`);

  const protectedResource = await atOAuthStage(
    'resource-discovery',
    () => discoverProtectedResource(entryServer.url, config.requestTimeoutMs),
  );
  const issuer = protectedResource.authorizationServers[0] ?? connector.auth.issuer;
  if (!issuer) throw stagedError('resource-discovery', `connector "${connector.id}" missing issuer`);

  const metadata = await atOAuthStage(
    'server-metadata',
    () => discoverServerMetadata(issuer, config.requestTimeoutMs),
  );
  const requestedAuthMethod = connector.auth.tokenEndpointAuthMethod ?? 'none';
  if (metadata.tokenEndpointAuthMethodsSupported.length > 0
      && !metadata.tokenEndpointAuthMethodsSupported.includes(requestedAuthMethod)) {
        throw stagedError('server-metadata', `the OAuth service does not support token_endpoint_auth_method=${requestedAuthMethod}`);
  }
  const callback = await atOAuthStage(
    'callback-listener',
    () => startCallbackServer({ path: '/callback', timeoutMs: config.callbackTimeoutMs, signal }),
  );
  try {
    const registration = await atOAuthStage('client-registration', () => registerClient(metadata.registrationEndpoint, {
      clientName: connector.auth.clientName,
      redirectUris: [callback.url],
      scope: connector.auth.scope,
      tokenEndpointAuthMethod: requestedAuthMethod,
      timeoutMs: config.requestTimeoutMs,
    }));

    const { verifier, challenge, method } = pkcePair();
    const state = generateState();
    const entryResource = protectedResource.resource ?? entryServer.url;
    const authorizeUrl = buildAuthorizeUrl(metadata, {
      clientId: registration.clientId,
      redirectUri: callback.url,
      state,
      challenge,
      challengeMethod: method,
      resource: entryResource,
      scope: connector.auth.scope,
    });

    logger.info(`opening authorization page: ${authorizeUrl}`);
    if (config.openBrowser) openBrowser(authorizeUrl, logger);
    else logger.info('openBrowser disabled — please open the URL above manually to authorize');

    const { code, state: returnedState } = await atOAuthStage(
      'authorization-callback',
      () => callback.waitForCallback(),
    );
    if (returnedState !== state) {
      const error = new Error('OAuth callback state mismatch — aborting (possible CSRF)');
      error.oauthStage = 'authorization-callback';
      error.oauthStageLabel = OAUTH_STAGE_LABELS['authorization-callback'];
      throw error;
    }

    const token = await atOAuthStage('token-exchange', () => exchangeCode(metadata.tokenEndpoint, {
      clientId: registration.clientId,
      clientSecret: registration.clientSecret,
      tokenEndpointAuthMethod: registration.tokenEndpointAuthMethod,
      code,
      redirectUri: callback.url,
      codeVerifier: verifier,
      resource: entryResource,
      scope: connector.auth.scope,
      timeoutMs: config.requestTimeoutMs,
    }));

        // Filter servers by the scope the token was actually granted for; fall back to all of them for a non-JWT token or when there is no resource claim
    const grantedUrls = extractTokenResources(token.accessToken);
    let grantedKeys;
    let grantedResources;
    if (grantedUrls) {
      const granted = new Set(grantedUrls);
      const grantedServers = connector.servers.filter((s) => granted.has(s.oauthResource ?? s.url));
      grantedKeys = grantedServers.map((s) => s.serverKey);
      grantedResources = [...new Set(grantedServers.map((s) => s.oauthResource ?? s.url).filter(Boolean))];
      if (grantedKeys.length === 0) {
        grantedKeys = [entryServer.serverKey];
        grantedResources = [entryServer.url];
      }
    } else {
      grantedKeys = connector.servers.map((s) => s.serverKey);
      grantedResources = [...new Set(connector.servers.map((s) => s.oauthResource ?? s.url).filter(Boolean))];
    }

    return {
      issuer,
      clientId: registration.clientId,
      clientSecret: registration.clientSecret,
      clientSecretExpiresAt: registration.clientSecretExpiresAt,
      tokenEndpointAuthMethod: registration.tokenEndpointAuthMethod,
      clientName: connector.auth.clientName,
      scope: connector.auth.scope,
      token,
      grantedKeys,
      grantedResources,
      entryResource,
    };
  } finally {
    await callback.close().catch((error) => logger?.warn(`close OAuth callback listener failed: ${error.message}`));
  }
}
