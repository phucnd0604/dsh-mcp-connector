# Migrating an existing `mcpServers` JSON to the MCP Connector

Back to the [first-success unified entry point](README.md).

When this applies: you already have another client's `mcpServers` configuration and want to manage it centrally in DeepSeek Harness instead of re-entering it one by one. This document only demonstrates trusted HTTP/stdio MCP Servers; it does not turn an ordinary API or CLI into an MCP server automatically.

## Before migrating: what to confirm first

1. Install `dsh-mcp-connector` following the unified entry point: in the default layout, both DSH Desktop and `dsh web` load the plugin from the local `web` profile. After installing, only restart the host you are using; for a customized profile layout, follow your host configuration.
2. Check every server in the original configuration: whether the remote URL is an MCP Streamable HTTP endpoint; whether the local `command`, `args` and runtime are trusted and can start on **the machine that runs DSH**.
3. Decide between "current project" and "all projects (global)" for each connection. "Global" only means the current DSH profile; it does not mean sharing across profiles.
4. Save a safe backup of the original configuration locally. Do not post the raw text containing tokens, API keys, cookies or local paths into issues, chats or public repositories.

## Importing a minimal example

Open "MCP Connector" in the left sidebar (or "Settings → Plugins → Plugin configuration → MCP Connector → Open MCP Connector"), click "＋ Add connection → Import JSON", and paste this locally:

```json
{
  "mcpServers": {
    "example-http": {
      "type": "streamable-http",
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer REPLACE_LOCALLY" }
    },
    "example-local": {
      "type": "stdio",
      "command": "node",
      "args": ["/replace/with/trusted/server.js"],
      "env": { "EXAMPLE_MODE": "readonly" }
    }
  }
}
```

The addresses, paths and credentials above are placeholder examples and cannot be connected to as-is. Replace them locally with the values from the provider's documentation; if you have no trusted local service, you can delete `example-local`. Historical `sse` is normalized to Streamable HTTP, which does not mean every old SSE address is compatible. External URLs should use HTTPS by default; for the explicit risk confirmation and the restrictions on cleartext HTTP to private IPs, see the [user guide](../USER-GUIDE.md).

Confirm the target scope before submitting, and view the connection in "Installed" after submitting. If the import or startup fails, check the diagnostics first; never judge availability from "the configuration appears in the list" alone. A custom HTTP server is validated against the MCP `initialize` handshake before saving; stdio waits for the Host's first initialization and tool sync.

## Three acceptance points for first successful use

| Acceptance point | Where to look | Pass condition |
|---|---|---|
| Configuration saved | The "Installed" page | The target connection exists, with the correct name and project/global scope |
| Tool discovered and registered | The "Tools" page and the DSH Host | The expected tool and its source appear in the current scope; check the `mcp__<serverName>__*` registration status if necessary |
| Business call succeeds | A normal DSH session | A read-only tool allowed by the provider is invoked through the Host permission/approval chain and returns a recognizable result |

The first two cannot replace the third; the fact that a tool cache is queryable does not prove the service is callable right now. Do not use paid, write or delete operations for first-time acceptance.

## Maintenance and rollback after migrating

- Under "Installed → Edit configuration" you can modify the normalized single-connection JSON of a **custom or JSON-imported** connection and save + reconnect. This does not restore the original JSON's layout/comments, and it cannot change the connection key or `serverName`. Sensitive values are represented by `<KEEP_EXISTING>`, meaning they are kept locally — do not paste real values into chats.
- "Config backup" can export redacted JSON; before migrating to another device you must refill the placeholders on the target device. OAuth grants cannot be carried over and must be re-authorized from the Market.
- Local snapshots of the current profile can preview and restore connection changes, but they may contain credentials and cannot be treated as a shareable public backup; OAuth grants revoked server-side cannot be restored from a snapshot.
- If the original client still manages the same `serverName`, first confirm whether there will be double connections or tool name conflicts, then decide whether to disable the old configuration. Do not delete the original configuration before the new path has passed the third acceptance point.

For more details, see the [user guide: JSON import](../USER-GUIDE.md), [config backup and restore](../CONFIG-BACKUP.md) and [connection scopes](../CONNECTION-SCOPES.md).