# When an OAuth connection does not succeed, locate which layer failed

Back to the [first-success unified entry point](README.md).

When this applies: a Market card requires OAuth 2.0 PKCE, but the button shows "Auto-retrying", "Reauthorization required" or a connection error. OAuth capability depends on the provider's public metadata, client registration, account permissions and network conditions; the plugin supporting the OAuth flow does not mean every Market connector is open to every account.

## Look at the status first, instead of clicking authorize repeatedly

1. Find the matching connection under "Market" or "Installed", and record the provider name, plugin version and button status — never record the token/authorization code.
2. Expand the diagnostics in the details view, and record `stage`, the stable `code`, `checkedAt` and the suggested action. `Status unknown` only means there is no observation evidence from the current process; it is neither success nor failure.
3. If it shows "Auto-retrying", first check the network and the provider's status and wait for the bounded backoff; a temporary refresh failure does not require immediate reauthorization.
4. If it explicitly shows "Reauthorization required", then start a new authorization from the card. Do not repeatedly attempt to log in to an enterprise account you are not authorized for, and never hand real credentials to third-party troubleshooters.

## Handling by failure stage

| Observed stage or code | Check first | Do not infer |
|---|---|---|
| OAuth metadata / dynamic client registration; HTTP 403 | Whether the provider allows public registration, requires pre-registered clients or enterprise eligibility | That a missing browser popup means the plugin is broken; that clicking again can bypass provider policy |
| `auth` / `refresh` | Account permissions, authorization scope, whether the grant has expired, the provider's revocation state | That every refresh error means permanent failure |
| `dns` / `tls` / `timeout` / `http` | DNS, proxy, certificates, VPN/dedicated line, allowlist, server status | That a successful authorization means the MCP endpoint is also usable |
| `protocol` | Whether the URL is a compatible MCP Streamable HTTP endpoint | That an ordinary web login URL or REST API URL can directly replace an MCP URL |
| `host-tools-pending` / `host-status-unavailable` | Whether the DSH Host completed tool registration and whether the version can report status | That "saved" equals "the tool is callable" |

Only when the page explicitly shows that client registration was rejected and the browser authorization step has not been reached should you attribute the problem to the provider's registration policy; this is not a user OAuth login failure. A provider may require registered clients, which cannot be bypassed by repeatedly attempting a user login.

## Verify the recovery, not just the authorization callback

1. After completing browser authorization, return to DSH and check the connection diagnostics and the most recent observation time. If a multi-server card has one abnormal server, the whole card may show "partially degraded".
2. Open "Tools" in the current workspace and confirm that the tools for the matching connection/service were discovered; if no workspace is selected, only global connections are shown. The last successful cache can help locate the problem but does not mean it is callable right now.
3. In a normal DSH session, verify one formal call with a provider-permitted **read-only** task. Tool execution, permissions and approval are managed by the DSH Host; the page's "Check connection" / "Rediscover tools" actions never execute the target tool.

Successful authorization, successful tool registration and a successful business call are three different results. Only when all three are done can you say "first use passed". Do not use calls that involve real business data, payment or side effects for public demos.

## Safe feedback template

When opening a [GitHub Issue](https://github.com/duhu2000/dsh-mcp-connector/issues), provide: the DSH version, plugin version, connector name, operating system, the redacted stage/code, the time, reproduction steps, and three separate conclusions — "did the browser reach authorization", "were the tools registered", "did the read-only call succeed". Do not upload tokens, API keys, cookies, authorization codes, complete headers, user information or local paths.

For the complete status semantics, see the [user guide: connection diagnostics](../USER-GUIDE.md).