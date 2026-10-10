# From install to the first successful call

This is the single shortest path. It strings the existing tutorials together into "install → connect → find a tool → make the first read-only call", and does not replace each provider's own documentation. For the first call, choose only a read-only task you are already permitted to use and whose cost and permission boundaries are clear; screenshots, GIFs, a successful connection or a tool cache do not equal a successful real business call.

When you need an acceptance task you can execute directly, choose one of the scenarios in [read-only company information lookup, local intelligent document parsing, authorized office document or schedule lookup](FIRST-SUCCESS-SCENARIOS.md); when recording status, use the [trusted status copy guidelines](TRUSTED-STATUS-COPY.md), and explicitly write "unknown / pending acceptance" when the account, organization, cost or invocation evidence is missing.

## 1. Install and restart the correct profile

In the current default install layout, DSH Desktop and `dsh web` both load the plugin from the local `web` profile, so both hosts use the same install command; do not switch the command to `--profile desktop` just because you are using Desktop.

```bash
dsh plugin --profile web add dsh-mcp-connector
```

After installing or upgrading, restart only the host you are actually using: DSH Desktop requires fully quitting the app and reopening it; `dsh web` requires stopping the original process and starting it again. Open "MCP Connector" in the left sidebar; if the sidebar entry is hidden, click "Open MCP Connector" from "Settings → Plugins → Plugin configuration → MCP Connector". Deployments with a customized profile layout should follow their own host configuration.

## 2. Pick exactly one connection path

- You already have another client's configuration: import it with [migrate `mcpServers` JSON](JSON-MIGRATION.md), and confirm the current project or global scope before submitting.
- You use an OAuth / API Key connector from the Market: authorize as the provider requires or enter credentials locally; if you get stuck, switch to [OAuth connection diagnostics](OAUTH-DIAGNOSTICS.md). Whether OAuth works depends on the provider's client registration policy, account permissions and authorization scope.
- You run your own HTTP / stdio server: follow the [user guide's custom connection instructions](../USER-GUIDE.md) and enter a trusted endpoint or a local command. An ordinary REST API or CLI does not automatically become an MCP server because of this.

After connecting, first confirm the name, the project/global scope and the enabled state in "Installed". This only proves the configuration was saved; it does not prove that the tool is registered or that the service is currently callable.

## 3. Find the tool you want to call

Open "Tools" in the current Workspace, search for the expected tool, and check the connection, server, tool source and parameters. If results are empty, stale, or the most recent discovery failed, follow [cross-connection tool search and recovery](TOOL-SEARCH-RECOVERY.md).

The Tools page only shows the safe cache of enabled connections in the current scope, and never executes the target tool. Before continuing, confirm the expected tool has been discovered; if necessary, check the `mcp__<serverName>__*` registration status in the DSH Host.

## 4. Complete the first read-only call in a normal DSH session

The plugin page has no approval-bypassing "dry run" button. Return to a normal DSH session and send the following after replacing the angle brackets:

```text
Please use only the MCP tool mcp__<serverName>__<toolName> to complete "<one read-only task the provider allows>".
Before invoking, list the tool source, the key parameters you will send, and whether it may incur cost or side effects.
If a write, payment, publication or deletion is needed, or if it exceeds the permissions of the current account, stop and ask me to confirm first.
```

Actual tool execution and permission/approval are managed by the DSH Host. The provider may impose additional account eligibility, quota and cost; do not use real sensitive data for first-time acceptance, and do not choose side-effecting operations such as writing, deleting or publishing.

## 5. Record three independent results

| Layer | Pass condition |
|---|---|
| Configuration | The target connection exists in "Installed", with the correct scope and enabled state |
| Discovery / registration | The expected tool and its source appear in "Tools"; confirm Host registration status if necessary |
| Invocation | A normal session completes a provider-permitted read-only call through the Host approval chain and yields a recognizable result |

Only when the third layer passes can this specific scenario be recorded as a "first successful call". If the third layer cannot be verified with real conditions, explicitly write "no data / pending acceptance" and do not infer it from download counts, page views, successful connections or demo material.

If this path actually helped you complete your first call, you are welcome to [Star the project](https://github.com/duhu2000/dsh-mcp-connector/stargazers), [submit a new connector](https://github.com/duhu2000/dsh-mcp-connector-registry/blob/main/docs/ONBOARDING.md) or [contribute](../../CONTRIBUTING.md).