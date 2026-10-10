# MCP Connector User Guide

This guide is for DeepSeek Harness (DSH) users who install and use `dsh-mcp-connector`. Service providers or MCP authors who want to submit a Market card should read the separate Registry's [third-party connector onboarding guide](https://github.com/duhu2000/dsh-mcp-connector-registry/blob/main/docs/ONBOARDING.md) instead.

## Start by task

If this is your first time, start with the [unified first-success entry point](tutorials/README.md): install and restart the correct profile, choose exactly one connection method, confirm the tool source, then return to a normal DSH session to complete the first provider-permitted read-only call.

- You already have another client's configuration: start from [migrate `mcpServers` JSON](tutorials/JSON-MIGRATION.md) and verify configuration saving, tool discovery/registration and the read-only call one by one.
- OAuth is stuck at registration, authorization or refresh: see [OAuth connection diagnostics](tutorials/OAUTH-DIAGNOSTICS.md), investigate by stage and stable code first, and do not repeatedly submit an account you are not authorized for.
- You connected multiple services but cannot find tools: see [cross-connection tool search and discovery failure recovery](tutorials/TOOL-SEARCH-RECOVERY.md). A queryable cache does not mean it is callable right now.
- You need one reviewable task: choose a read-only scenario for company information, local documents or authorized office data from the [three first-success scenario packs](tutorials/FIRST-SUCCESS-SCENARIOS.md), and record unknown items and evidence according to the [trusted status copy](tutorials/TRUSTED-STATUS-COPY.md).

These operation tutorials and scenario packs do not represent completed real business call acceptance for every provider; formal calls remain subject to provider permissions, cost and DSH Host approval.

## 1. Install, upgrade and restart

Requirements: DSH Desktop or the `web` profile, Node.js 20 or later.

```bash
dsh plugin --profile web add dsh-mcp-connector
```

You can also run the one-click install script:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/duhu2000/dsh-mcp-connector/main/install.sh)
```

Just run the same install command again to upgrade. After installing or upgrading, DSH must **fully exit and restart**; refreshing the browser page alone is not enough to replace already-loaded plugin code.

- DSH Desktop: quit the app and reopen it.
- `dsh web`: stop the original process, then run `dsh web`.
- Browser access: opens `http://127.0.0.1:3080` by default.

If re-running `dsh web` produces `EADDRINUSE 127.0.0.1:3080`, a DSH process is already listening on port 3080; this does not mean the plugin failed to install. You can open the existing page directly; if you really do need to restart, stop the process in the original terminal first, or use the read-only command below to confirm the listener, then end the corresponding PID normally:

```bash
lsof -nP -iTCP:3080 -sTCP:LISTEN
kill <PID>
dsh web
```

Do not start two `dsh web` instances at the same time.

## 2. Open the MCP Connector

After restarting, you can open it in any of these ways:

- Click "MCP Connector" in DSH's left main navigation. DSH `>=0.2.0-rc.2` uses the host's native panel row, so expand, collapse, selected state and keyboard operation behave like the other main navigation entries; DSH `0.1.x` automatically uses the compatibility entry at the bottom left.
- Open "Settings → Plugins → Plugin configuration → MCP Connector", expand the card and click "Open MCP Connector". This button reuses the same connector modal directly and does not require the sidebar entry to be visible; closing the modal still returns to the settings page.

To free up sidebar space, you can turn off "Show MCP Connector in sidebar" on the same configuration card. This preference applies to the current DSH profile and persists after a restart; it only hides the shortcut entry and does not disable the plugin, connected MCP Servers or tools. If you hide it while the native connector panel is open, the page first returns to the current session; afterwards you can still open the modal directly from that configuration card, or re-enable the entry. On older DSH versions without Settings capability, the plugin keeps the entry visible and does not enter Safe Mode because of this feature.

The top of the page provides:

- **Market**: browse the public connectors merged from the built-in catalog and the remote Registry; the tab badge shows the current card count.
- **Installed**: view connections already saved on this machine; the tab badge shows the connection count.
- **Search**: find by name, provider, summary and tags.
- **Add connection**: import JSON, manually configure HTTP/stdio, or install from a Market descriptor URL.
- **Version and update notice**: the current plugin version is shown next to the title, and the version check does not depend on the plugin marketplace used for installation. When a newer npm version is detected and the current host has a compatible Update Provider, you can update in one click on the current page and view progress, failure causes and available rollback. The DSH Market API v1 is the current first Provider; when no Provider is available, it shows "View update options", and when the host has no plugin marketplace section it opens the npm installation instructions.
- **Refresh connector catalog**: re-fetches the Registry cards and updates connection health status; this action does not upgrade the MCP Connector plugin itself.

## 3. Browse the Market and categories

"Recommended" is selected by default, and the page displays sections in this order: Recommended, Enterprise Data, Finance & Investment, Legal & Compliance, Developer Tools, Office & Collaboration, Research & Analysis, Design & Creative, Productivity, Other.

- The featured slot is fixed at 6 curated cards; other cards still appear in their own business categories.
- Each section shows at most 4 cards first; when there are more, click "View all N" and then "Collapse".
- After clicking a category tab, only all cards of that category are shown.
- The category bar is fixed inside the page header and never covers content while scrolling cards; it hides automatically after switching to "Installed".
- When the remote catalog is unavailable, the plugin keeps using the last cache or the bundled catalog, which does not affect existing connections.

## 4. Connect a Market card

Before a new connection is submitted, the target scope is displayed. When a Workspace is already selected in DSH the default is "Current project"; after choosing "All projects (global)", every Workspace in the current profile inherits that connection. OAuth, no-auth, Bearer/API Key, JSON import and URL installation all use the same rule.

The button on the right of a card changes according to the auth method and current status:

| Button/status | Meaning | Action |
|---|---|---|
| `Connect` | An OAuth or no-auth connector is not yet connected | Click it and complete authorization or the connectivity check as the page instructs |
| `Configure` | A bearer token or API key is required | Enter the provider-issued credential and validate it |
| `Reauthorize` | The OAuth authorization has expired, been revoked or is unavailable | Click it to complete OAuth authorization again |
| `Auto-retrying` | The OAuth token refresh hit a temporary network or server-side failure | No reauthorization is needed; keep DSH running and the plugin recovers automatically with a backoff policy |
| `Status unknown` | A local configuration exists, but this process has not yet observed an availability check result; it does not mean healthy or error | Click "Refresh connector catalog" or open the details to check |
| `Connected` | The most recent health check passed | The corresponding MCP tools can be used directly in a session |
| `Partially degraded` / `Connection error` | One or more servers failed the check | Open the details to read the hint, and check the network, permissions and service status |

Bearer/API Key connectors first run an MCP `initialize` validation. Only after all servers pass are the credentials saved and shown in "Installed"; a failed validation never writes new credentials.

stdio Market cards may also show one or more credential fields, such as an API token, region or tenant identifier. The card catalog only declares the field names and their environment variable mapping; after submitting, the real values are stored only in the DSH local connection record and injected by the plugin into that stdio process's `env`. The Market, status pages and logs never return these values. The plugin waits for the Host to finish the first MCP initialization and tool sync before saving the connection; a failure or timeout does not increase the installed count, and the card never shows "Connected" early.

"Qichacha · Intelligent Document Parsing" configures two non-conflicting entry points through a single one-click OAuth authorization:

- `qcc-document`: a remote Agent that parses online document or image URLs reachable from the public internet.
- `qcc-document-mcp`: a local Agent that reads local files uploaded or pasted in the conversation, or at a specified path, via `npx -y qcc-document-mcp`, then uploads them automatically and submits the parse; requires Node.js 20+.

After clicking "Connect" you only need to complete one Qichacha OAuth authorization, and the plugin registers both servers above. The OAuth access token is injected only at runtime as `QCC_DOCUMENT_AUTHORIZATION` in the local subprocess, and is never written to the Market catalog, connection records, page status or logs; after the token refreshes, the local Agent updates automatically. When upgrading from an older manual API Key configuration, click "Upgrade to one-click authorization"; the old connection is atomically replaced only after the new authorization and both servers have started successfully; a failure keeps the original configuration.

If an older version only configured the remote entry point, the card shows "Upgrade to one-click authorization" and never misreports a single entry point as a complete connection. After OAuth completes, the plugin first validates both servers and then saves atomically; if either entry point fails, no half-configuration is left behind.

One-click OAuth connection requires the provider to support standard OAuth 2.1/PKCE and public metadata discovery. Dynamic client registration supports both `none` without a client secret and the provider-issued `client_secret_post` and `client_secret_basic`. The client secret is stored only on the DSH machine together with the OAuth grant, and is used to exchange, refresh and revoke tokens; the plugin never asks users to paste OAuth tokens or client secrets into chats. If the provider returns HTTP 403 during dynamic client registration, the page clearly states "client registration rejected, browser authorization not yet reached"; this usually requires provider review or client registration, and retrying user authorization cannot bypass it.

When the Market descriptor declares `grantSharing: "issuer"`, cards under the same account with the same issuer, scope and client authentication method share one set of grants. The first authorization still enables only the card the user clicked; afterwards, connecting a card in the same group reuses the existing authorization directly without reopening the OAuth page. On upgrade it validates and automatically merges the duplicate same-issuer grants left by older versions; when Desktop and `dsh web` run concurrently, the plugin uses a cross-process lock to serialize rotation and reads the latest token from each grant's independent atomic journal, avoiding a stale process snapshot of DSH's whole-file storage overwriting new credentials. Temporary failures such as network problems, OAuth metadata discovery errors or server-side 5xx only enter "Auto-retrying"; it enters "Reauthorize" only after confirming that the journal also has no newer token and that an explicit refresh-token/client-invalidation error was received.

## 5. View details, prompts and tools

Click a card or "Details" to open the connector details:

1. Read the service description, auth method, data scope and any possible cost or side effects.
2. Choose a sample prompt in "Try it like this"; templates with variables will first ask you to fill in the query subject and similar details.
3. Expand "Tool details" to see the number of servers, tool names and descriptions, and to search tools; click "Parameter details" to view the input schema on demand; after connecting you can also set governance rules by Connection, Server and Tool.
4. Click "Try it" or the prompt's send button to create or reuse a blank session in the current workspace and write the draft.

After a successful connection, tools are provided to the model with the `mcp__<serverName>__*` prefix. The tool list comes from the server, and the actual count varies with provider permissions and versions. After a successful discovery, the plugin saves a safely truncated copy of the tool metadata in the current profile; when live discovery fails it still shows this "last successful cache", but keeps the connection in a failed/unknown state and labels the cache time, and shows a stale notice beyond 24 hours. The details and "Installed" list show the most recent diagnostic stage, stable error code, description, suggested action and last success time.

In a conversation you can use `mcp_connector_tool_search` to search the cache by name, title or description, then `mcp_connector_tool_detail` to read a specific tool's parameter schema precisely. Both are for discovery only; they do not proxy or execute MCP calls.

### 5.1 Tool workbench: unified tool search

1. Connect the required MCP services first and open the "Tools" page at the top; tool discovery runs in the background, and you do not need to open each connection's details first.
2. Enter a keyword from the tool name or description. An exact tool name takes priority; tools with the same name may still come from different connections, so check the source.
3. Use the "Connection", "Service" and "Discovery status" filters to narrow the range, and click "Clear filters" to restore. Results are shown page by page.
4. The Tools page searches the successful cache of enabled connections visible in the current scope, not the tools of every uninstalled connector in the Market. Without a selected Workspace, only global connections are shown.
5. When there are no results, clear the filters first and confirm the connection is enabled, the scope is correct and at least one discovery has succeeded; the first discovery may still be pending.

### 5.2 Inspect parameters and sources

Each result shows the connector, connection, service, most recent discovery status and last successful cache time. Click "Parameter details" to see the type, required flag, description, enums and nested structure.

Complex references, composition rules or oversized structures will show a summary-limit notice; expand "Raw schema (safe cache)" to keep reading. The raw schema here is still a safely truncated cache; it excludes removed defaults or examples and does not guarantee that over-limit fields are preserved. This page never executes tools.

### 5.3 Discovery status and the last successful cache

"Not discovered yet" means there is no current discovery status yet; "Host status unknown" means the host status cannot be confirmed; "Last discovery succeeded/failed" only refers to the most recent discovery and does not guarantee the result of a subsequent call.

On failure, the existing last successful tool cache is still viewable; beyond 24 hours a stale notice appears. Without a success record there is no cache to provide, and a successful empty list does not indicate a fault. Reconfiguring, disabling or disconnecting a connection may make the original results no longer visible.

### 5.4 Check the connection and rediscover

Expand "Connection status and troubleshooting" and read the stage and suggestion first. "Check connection" runs a health check for that connection; "Rediscover tools" re-fetches that connection's tool metadata. Neither is a dry run of the target tool, and neither guarantees an automatic fix.

Concurrent operations on the same connection are merged and frequent operations have a cooldown; actions on the Tools page cannot bypass a valid rate-limit wait. For an authentication failure, go to the "Installed" page to update credentials or reauthorize.

Healthy background discovery expires after five minutes; while the page keeps its SSE connection, due items are checked on schedule, ordinary faults use exponential backoff, rate limiting honours `Retry-After`, and authentication failures pause automatic retries. Do not mistake "Refresh the tools view" for forcing a visit to every service — it only refreshes the cached view.

## 6. Add a custom connection

After clicking "＋ Add connection" there are three options.

### 6.1 Import `mcpServers` JSON

Streamable HTTP, historical `sse` configurations and stdio are supported. Historical `sse` is automatically normalized to Streamable HTTP.

```json
{
  "mcpServers": {
    "my-http-server": {
      "type": "streamable-http",
      "url": "https://example.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_ACCESS_TOKEN"
      }
    },
    "my-local-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@vendor/example-mcp-server"],
      "env": {
        "EXAMPLE_MODE": "readonly"
      }
    }
  }
}
```

Replace the sample placeholders with your own values before importing. Credentials should only be imported locally; do not commit JSON containing real tokens, API keys, passwords or cookies to Git, issues or chats. When importing a cleartext HTTP endpoint on a private IP, you must explicitly add `"allowInsecurePrivateNetwork": true` in the corresponding server entry; this flag is preserved in redacted exports.

### 6.2 Manual setup

- **HTTP**: enter a name, an HTTPS MCP URL, optional headers and the transport. Loopback HTTP can be used directly; cleartext HTTP on a private LAN IP requires ticking the risk confirmation.
- **stdio**: enter the local command, arguments, environment variables and an optional working directory.

stdio processes are managed by `@deepseek-ai/dsh-mcp-client`; the plugin passes through `command`, `args`, `env` and `cwd`, and waits for the Host to complete the first MCP initialization and tool sync. stdio starts the local process with the current user's permissions and only runs packages and commands you trust. Manual HTTP configuration also runs an `initialize` validation before saving; when validation fails, the form contents are retained and no invalid connection record is created.

### 6.3 Market card URL

Enter a public HTTPS Connector Descriptor URL. The descriptor may only carry public metadata and must not contain any credentials; after installation the user still completes OAuth or enters a key locally.

## 7. Manage installed connections

In "Installed" you can:

- view connection status and the number of servers;
- edit the normalized JSON of a custom or JSON-imported connection and reconnect after saving;
- change the display name of a custom or JSON-imported connection without disabling it first;
- choose "Always inject" or "Enable per session (experimental)";
- enable or disable a connection;
- reauthorize OAuth, or re-enter a token/API key;
- run a health check;
- disconnect and delete that connection's local configuration.

When disconnecting OAuth, the plugin makes a best effort to call the provider's revocation endpoint; when there is no revocation endpoint it still deletes the DSH local authorization record. After the connection status changes, you can click "Refresh connector catalog" to re-check.

"Rename" only changes the connection display name the user sees; it does not change the connection key, `serverName`, the `mcp__<serverName>__*` tool prefix, the connection scope, the credentials or the enabled state, and it does not remount the MCP Server. The names of Market connectors continue to be maintained by the public catalog.

"Edit configuration" shows one normalized `connections` JSON; it does not guarantee restoring the layout, comments or field aliases of the originally imported text. `serverName` together with the connection key identifies the existing connection, so neither can be changed here; if you need a new tool prefix, create a separate connection. Tokens/API keys, header/env values, stdio arguments, local directories and URLs that may contain credentials are never returned to the page and instead appear as `<KEEP_EXISTING>`: the keep marker means continue using the original local value, the replace marker lets you enter a new value, and deleting the field clears the entry.

For an enabled connection, clicking "Save and reconnect" first validates the new configuration and creates a snapshot, then atomically updates the Host and the local record; any validation, startup or persistence failure keeps the original connection. A disabled connection can save its configuration while remaining disabled. Neither the connection scope nor the enabled state is silently changed by JSON. Market/OAuth connections continue to use the card's "Configure" or "Reauthorize" flow.

### 7.1 Config backup and restore

"Config backup" on the "Installed" page provides two complementary capabilities:

- **Redacted export**: copy or download portable JSON. Tokens/API keys, static header/env values, stdio arguments, local directories and URLs that may contain credentials become explicit placeholders that must be refilled on the target device before importing. OAuth exports only a connection reference and must be reauthorized from the Market.
- **Local snapshot**: automatically saves the changed scope before connecting, configuring, importing, renaming, enabling/disabling or disconnecting, and can also be created manually; at most 20 are kept. Before restoring you can review which keys will be restored and removed, and if any server or persistence step fails during the restore, everything rolls back to the pre-restore state.

A snapshot may contain local credentials used for an exact restore, so it is stored only in the current profile's storage domain and is never returned verbatim through the Web API, conversation tools or logs. After disconnecting and revoking OAuth, a snapshot cannot recreate the server-side grant and explicitly requires reauthorization. For the full boundaries, see the [config backup notes](CONFIG-BACKUP.md).

### 7.2 Connection, Server and Tool governance

"Tool details" in the connector details supports three layers of allow/deny: a Tool rule takes priority over a Server, a Server takes priority over a Connection, and without an explicit rule the default is allow. Disabling a connection on the "Installed" page is a physical offline state and cannot be overridden by a lower-level allow.

Every change first shows a preview of the impact on Host-observed tools, and is submitted by revision once confirmed; if the policy changes concurrently you will be asked to preview again. The most recent 20 revisions can be rolled back. Deny rules take effect through the DSH Host's per-Agent restrictions and the final execution Guard, not merely by hiding the page.

When a tool has not yet been observed by the Host it shows "Not observed", and is never reported as "Disabled" or "Healthy". After a tool is deleted or renamed, the old rules are marked invalid but do not harm the new tool; newly registered tools automatically inherit the Server/Connection rules. For the full semantics, see the [governance notes](TOOL-GOVERNANCE.md).

### 7.3 Enabling tools per session

"Always inject" is the backwards-compatible default for existing connections. When a connection has many tools but is only used in a few sessions, you can switch it to "Enable per session (experimental)" in "Installed". The connection and OAuth/API key lifecycles are unchanged; the Host simply hides that connection's business tools by default in each Agent.

In a conversation, `mcp_connector_session_tools` first uses `search` to locate the exact `publicName`, then uses `preview-activate` to get the revision, and `activate` is only allowed after the user explicitly specifies it. The default TTL is 30 minutes and can be set to 1–30 minutes; activation takes effect from the next model inference boundary. After the session ends, the TTL expires, the plugin restarts or DSH restarts, it returns to the dormant state.

Session activation cannot override project/global scope, Connection/Server/Tool `deny`, connection disabling or Host approval. The plugin does not store session text, trigger words or tool parameters, and the current version does not auto-activate based on keywords. For the full flow and troubleshooting, see the [enable per session notes](SESSION-TOOL-INJECTION.md).

### 7.4 project/global connection scope

"Installed" shows the scope on each connection. Click "Scope" to choose:

- "Copy" adds a binding for the current project or globally, keeping the original scope;
- "Move" replaces the original binding with the selected scope.

Before submitting, the page lists the affected servers and known tools. It is only written by revision after confirmation, and "Roll back the last scope change" can restore it. A scope change does not copy tokens, API keys or OAuth grants; when different connections manage the same `serverName`, silent overwrite is refused. For the full behaviour and failure boundaries, see [project/global scopes](CONNECTION-SCOPES.md).

### 7.5 How to understand connection diagnostics

Diagnostic results only state facts the plugin actually observed, and never treat "configuration saved" as "connection healthy":

- `unknown` / `Status unknown`: there is no active check result within this process, or the Host temporarily cannot provide the stdio tool registration status. It is neither success nor failure.
- `stage` / `stageLabel`: which layer the failure or unknown state occurred in, for example auth, network and transport, MCP initialization, Host startup, Host status observation or tool discovery.
- `code`: a stable code that is convenient to reference in issues, automation and troubleshooting, for example `auth`, `dns`, `protocol`, `host-tools-pending`.
- `message` / `action`: the current observation and the suggested next step; they never contain tokens, API keys or OAuth client secrets.
- `checkedAt`: the most recent observation time; `lastSuccessfulAt`: the most recent time confirmed available within the current plugin process. After the plugin restarts, if it has not re-checked yet, the time is empty and the state returns to "Status unknown" — an unverified healthy state from a previous process is never carried over.

For a multi-server connector, as long as some servers are available and some are degraded, it shows "Partially degraded"; each installed connection still keeps its own diagnostics. A temporary OAuth access token refresh failure shows "Auto-retrying"; only an explicit permanent authorization failure shows "Reauthorize".

## 8. Compatibility, architecture and responsibility boundaries

### 8.1 Compatibility matrix

| Capability | Currently supported | Notes |
|---|---|---|
| DSH host | Desktop / `web` profile | Node.js 20+; connections are saved in the current profile |
| Official MCP client | `@deepseek-ai/dsh-mcp-client` `^0.1.1-rc.2` | Owns the connection lifecycle, stdio processes and tool registration |
| Transport | Streamable HTTP, stdio | Historical `sse` configurations are normalized to Streamable HTTP |
| Auth | No auth, Bearer, API key, OAuth 2.0 PKCE | OAuth supports dynamic client registration and grant sharing |
| Config exchange | JSON import, redacted export, local snapshot | Placeholders must be refilled; restore is atomic; revoked OAuth requires reauthorization |
| Scope | Workspace project / profile global | Global is inherited by all Workspaces; project-only tools are isolated by Host restriction + guard |
| Governance | Connection lifecycle enable/disable; Connection / Server / Tool allow/deny | Rules apply to the current profile and support preview, revision submission and rollback |
| Tool capability | Tool list and description discovery | There is no tool dry-run button; tools are never invoked by bypassing the Host permission/approval chain |

### 8.2 Who is responsible for what

- **The MCP Connector plugin**: the Market catalog, configuration entry, OAuth/key lifecycles, connection records, governance rules, creating entries in the official MCP client, read-only health checks, tool discovery and diagnostic display.
- **The DSH Host and `@deepseek-ai/dsh-mcp-client`**: HTTP/stdio transport, stdio subprocess environment cleanup and startup, the MCP lifecycle, tool registration, real tool execution, and the permission and approval flows provided by the host.
- **The MCP Server / service provider**: tool definitions, account permissions, quotas, cost, data freshness and actual side effects.
- **The user and the model**: confirming the purpose, parameters and impact of a call; for side effects such as writing, paying, publishing or deleting, follow the Host's confirmation/approval flow.

The plugin never rewrites the official MCP transport and never calls MCP tools directly from the browser. DSH already provides formal ToolRuntime execution, cancellation, timeout and one-time approval contracts; however, a direct dry run on the details page still lacks an out-of-turn user orchestration entry point, and the official MCP bridge does not pass through tool side-effect annotations. For the security thresholds and version evidence, see the [tool trial design](TOOL-TRIAL-DESIGN.md).

### 8.3 Current limitations

- The health summary and last success time are currently kept only inside the plugin process; after a restart it shows "Status unknown" until re-checked.
- The HTTP tool list is discovered with the read-only MCP `tools/list`; the stdio tool list reads the tools already registered by the Host. When the Host provides no observable status, only unknown can be reported.
- The last successful tool cache only stores names, titles, descriptions and a safely truncated input schema; it never stores call parameters, call results, raw errors or credentials; disconnecting, changing the connection configuration or restoring a snapshot clears the related cache.
- Live page status uses same-origin SSE, and events only send the change category, sequence number and time; on a dropped connection the browser reconnects automatically per EventSource rules, and the page actively refreshes once when it becomes visible again.
- Connection credentials, snapshots, governance rules and scope history are all stored in the current profile; project/global do not sync across profiles.
- After a Workspace is deleted, the original project-only binding stays fail-closed and must be moved manually to the current project or globally.
- Connection-level disabling is reversible; disconnecting deletes the local connection and makes a best effort to revoke OAuth when the authorization is no longer shared. Non-OAuth configurations can be restored from a pre-disconnect snapshot; revoked OAuth must be reauthorized.

## 9. Security boundaries

- Credentials are stored only in the DSH storage domain, and never enter the Market catalog, Git repositories or chat history.
- A stdio catalog can only declare credential fields and env mappings, never real values; the Registry probe never executes local commands from the catalog.
- The `client_secret` returned by OAuth dynamic registration never appears in the catalog, connection status or logs; when disconnecting, it is revoked together with the refresh token on a best effort and the local record is deleted.
- External addresses must use HTTPS by default, and HTTP is allowed for local loopback addresses. A user's own connection may use cleartext HTTP with an RFC1918 IPv4 literal (`10/8`, `172.16/12`, `192.168/16`) or an RFC4193 IPv6 ULA literal only after explicitly confirming the risk. Domains, public HTTP, link-local and cloud metadata addresses are still refused; once enabled, credentials and tool data may be sniffed or tampered with on the same network segment.
- The Registry health probe holds no user credentials and never executes stdio commands from the catalog.
- The data the connector can see and the operations it can perform depend on the account permissions you grant; prefer a least-privilege token/API key.
- For side-effecting tools such as generating, paying, writing, publishing, deleting or stopping tasks, confirm the parameters and impact again before execution.

## 10. FAQ

### No entry point after install, or the UI is still the old version

Confirm that the install target is the `web` profile, then fully quit and restart DSH. A browser hard refresh only reloads static pages and cannot replace the old plugin process that is still running.

### The latest cards are missing from the Market

Click "Refresh connector catalog". If the remote Registry is temporarily unavailable, the page keeps showing the cache or bundled catalog; restore the network and refresh later.

### A token/API key keeps failing validation

Check whether the credential has expired, whether it has permission for the target MCP Server, whether the header type is correct, and whether the provider requires separate activation or payment. A failed candidate credential never overwrites the existing working local configuration.

### stdio fails to start

The page ends its wait within a bounded time and distinguishes a missing command, a process exit, an initialization failure or a startup timeout. First confirm in the terminal that the command itself is executable, the package is trusted and the Node/runtime version meets the requirement, and check `cwd`, arguments and environment variables; then look at the Host logs and click "Recheck". Do not write local credentials into a public Registry descriptor.

#### 1. Confirm the command and runtime environment

stdio starts the process on the machine running DSH with the current user's permissions, and only runs packages and commands you trust. First record `command`, each `args` element, `cwd` and the required environment variable names from the connection configuration; do not copy or publish credential values. The example below uses Node — replace it with the actual command for other runtimes.

macOS / Linux (terminal):

```sh
command -v node
node --version
pwd
```

Windows (PowerShell):

```powershell
Get-Command node -All | Select-Object CommandType, Source
node --version
Get-Location
```

If the command cannot be found, configure the runtime according to the trusted software's official installation instructions first, then reopen the terminal and DSH. Verify the runtime version the service requires. A terminal finding the command does not mean a desktop-launched DSH has the same `PATH`; version managers, aliases or shell functions may not be visible to DSH either. In that case you can change `command` to the absolute path of the actual local executable — do not put a terminal alias in it.

#### 2. Reproduce the same command + args in the same directory

The paths below are placeholders and must be replaced with the real paths of a trusted service installed on your machine; the example downloads no software and needs no account or credentials. Assume the configured `command` is the absolute path of Node and `args` contains only the absolute path of the service entry file:

macOS / Linux:

```sh
(
  cd '/absolute/path/to/trusted-server' || exit 1
  '/absolute/path/to/node' '/absolute/path/to/trusted-server/server.js'
  result=$?
  printf 'exit code: %s\n' "$result"
)
```

Windows PowerShell:

```powershell
Push-Location -LiteralPath 'C:\path\to\trusted-server' -ErrorAction Stop
try {
    & 'C:\path\to\node.exe' 'C:\path\to\trusted-server\server.js'
    Write-Output "exit code: $LASTEXITCODE"
} finally {
    Pop-Location
}
```

Replace the arguments one by one according to your own configuration. Do not paste a whole terminal command into `command`, and do not merge all arguments into a single string. Paths containing spaces need quoting in the terminal; keep the path itself in the configured `command` or `args` string value without adding extra shell quotes. Only when the service depends on relative paths do you need to specifically verify that `cwd` in the configuration exists, is accessible and meets the service's requirements. Required environment variables should be configured securely on your machine; do not paste the complete `env` or a command line containing secrets into feedback.

On Windows, `.cmd` / `.bat` are script wrappers and are not equivalent to a directly launchable `.exe`; being able to run a wrapper in PowerShell does not mean a shell-less process launch can run it too. If the diagnostics point at a wrapper, choose a native executable according to that service's documentation, or run its trusted JavaScript entry with Node. Do not work around this by setting `shell: true`, disabling security checks or execution policies.

#### 3. Locate the cause from the results, then re-check on the page

| Observed result | How to investigate |
|---|---|
| Command not found / path not found | Check the runtime installation, the absolute path and the DSH process's `PATH`; also confirm that `cwd` exists |
| Process exits non-zero immediately | Inspect local stderr and the exit code, and check the arguments, dependencies, runtime version, file permissions and required environment variables |
| Process exit code is 0, but no tools | Confirm that what started is an MCP stdio service, not a version query, installer or one-off command; a successful exit does not mean MCP initialization succeeded |
| The process waits forever with no output | The stdio service may be waiting for client input, which is a normal possibility; starting it from the terminal only verifies the process and does not prove the MCP handshake succeeded. You can end it with Ctrl+C and then let DSH run the check |
| It starts in the terminal but initialization fails/times out on the page | Compare DSH's command/args/env/cwd and check the Host logs; confirm the service supports MCP stdio and that ordinary logs do not pollute the stdout used for protocol traffic (logs should go to stderr) |

Restart DSH after fixing it (if the process environment changed), click "Recheck" on the connection details and confirm the tool discovery result. When reporting, submit only versions, redacted diagnostic codes, exit codes and necessary logs; never upload tokens, API keys, complete environment variables or personal paths.

### Why does it show "Status unknown"

This means the plugin lacks sufficient evidence to confirm health or failure, which is common right after DSH restarts before a health check runs, or when the current Host cannot read the stdio tool registration status. Click "Refresh connector catalog" or open the details to re-check; if it is still unknown, follow the diagnostic `code` and suggestion to check the Host logs or upgrade the Host. Do not read "Status unknown" as "Connected".

### How to troubleshoot by diagnostic code

| Code example | Check first |
|---|---|
| `auth` | Whether the token/API key has expired, whether the account has permission for the target Server, and whether OAuth needs reauthorization |
| `refresh` | The network, the OAuth service status and the automatic retry time; do not reauthorize repeatedly immediately |
| `dns` / `tls` / `timeout` / `http` | DNS, proxy, VPN/dedicated line, certificates, IP allowlist, URL and service status |
| `protocol` | Whether the URL is a compatible MCP Streamable HTTP endpoint |
| `process-not-found` / `process-exit` / `startup` | The local runtime, command/args/env/cwd, exit code and Host logs |
| `host-tools-pending` / `host-status-unavailable` | Whether the Host completed tool registration and whether the Host version supports status reading |

### How to report a problem

When submitting a [GitHub Issue](https://github.com/duhu2000/dsh-mcp-connector/issues), please provide the DSH version, plugin version, connector name, reproduction steps and redacted error information. Do not attach tokens, API keys, cookies, authorization codes or configuration files containing real credentials.