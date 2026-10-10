# Finding tools across connections, and recovering after discovery fails

Back to the [first-success unified entry point](README.md).

When this applies: you have connected multiple MCP Servers and want to find tools by task and inspect their parameters; or a connection's most recent discovery failed but you still need to determine what tools it once had. This document does not demonstrate executing real business tools.

## First locate the right tool

1. Select the target Workspace in DSH, then open "MCP Connector → Tools". Without a selected Workspace you only see global connections; project connections do not leak across boundaries.
2. Enter a keyword from the tool name or description. An exact tool name takes priority; results with the same name still require checking the connection, service and source.
3. Use the "Connection", "Service" and "Discovery status" filters. If results are empty, clear the filters first, then confirm the connection is enabled, the scope is correct, and at least one discovery has succeeded.
4. Click "Parameter details": start with the type, required flag, enums and the expandable nested summary; for complex rules, open the "Raw schema (safe cache)". It is still safely truncated and size-limited, and is not the server's complete original text.

The Tools page searches the **last successful safe cache of enabled connections in the current scope** — not the tools of uninstalled connectors across the whole Market. Searching/filtering does not request the target service and does not execute the target tool.

## What to do when the most recent discovery failed

1. Look at the connector/connection/service source on the result, the most recent discovery status and the "last successful cache time". A cache older than 24 hours is marked stale; being able to read the cache does not mean the service is callable right now.
2. Expand "Connection status and troubleshooting" and read the failure stage, the stable code and the suggestion first. `Status unknown` does not mean the connection succeeded.
3. Follow the suggestion and use "Check connection" or "Rediscover tools". The former checks the health of a single connection; the latter re-fetches that connection's tool metadata. Neither is a dry run of the target tool, and neither guarantees an automatic fix.
4. On 429/rate limiting, wait for the displayed retry time and do not click repeatedly. Manual actions on the Tools page cannot bypass valid rate limits; an authentication failure requires updating credentials or reauthorizing.
5. After fixing it, observe the discovery status and time again; finally, invoke an approved read-only tool in a normal DSH session to confirm the real business path.

Background discovery handles at most two connections in parallel. A healthy connection expires **after five minutes** — it is not exact five-minute polling nor permanent real-time polling; ordinary failures use exponential backoff, and authentication failures pause automatic retries. A page status notification is not a continuous health probe.

## A reviewable standard for first success

| Layer | What you should see |
|---|---|
| Connection | The matching connection exists in "Installed", with the correct scope and enabled state |
| Discovery / registration | The expected tool, its source and the last success time appear on the Tools page; verify Host tool registration if necessary |
| Invocation | A provider-permitted read-only call completes through the Host approval chain in a normal session and returns the expected result |

Do not substitute cached search results for invocation acceptance, and do not paste real parameters, results or credentials into public feedback. For further diagnostics, see the [user guide: tool workbench](../USER-GUIDE.md).