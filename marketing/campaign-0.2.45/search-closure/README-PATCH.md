# Public Documentation Suggested Text (Not Applied)

Date: 2026-09-13. The central integrator applies this by heading anchor after verifying the latest content. This file is not a claim that the public README has been modified.

## README.md

In "### Tool discovery and troubleshooting", replace the existing two paragraphs with:

> Search cached tools across enabled connections visible to the current workspace in the Tools tab. Enter a tool name or description, then filter by connection, service, and recent discovery status; click "Parameter details" to see types, required fields, and nested structures. Without a selected workspace, only global connections appear.
>
> Results identify their source and last successful cache time. When discovery fails you can still view the existing cache, but that does not mean the service is currently callable. Expand "Connection status and troubleshooting" and, following the suggestions, use "Check connection" or "Rediscover tools". Healthy discovery becomes due after five minutes, and while the page remains connected the background checks due tasks; failures back off, and authentication failures pause automatic retries.
>
> See the [tool workspace guide](docs/USER-GUIDE.md) for details. The tools page is for discovery and diagnostics and does not execute the target tool; both parameter summaries and the raw security cache have redaction boundaries.

After the connection management steps in "## Usage", add:
> After connecting, open the "Tools" page and look up capabilities by tool name or description, using the connection/service filters to locate the source; authorization, cost, and formal invocation remain managed by the respective service and Host.

The hero, marketing comparison table, and image order are left to the unified copy integration and are not duplicated in this patch. No image references are added before the new images pass acceptance.

## docs/USER-GUIDE.md

Insert at the end of section 5, before the existing "## 6. Add a custom connection":

### 5.1 Tool workspace: unified tool lookup

1. First connect the required MCP service and open the "Tools" page at the top; tool discovery runs in the background, and there is no need to open each connection's details page first.
2. Enter a keyword from the tool name or description. Exact tool names take priority; tools with the same name may still come from different connections, so verify the source.
3. Use the "Connection", "Service", and "Discovery status" filters to narrow the scope, and click "Clear filters" to restore. Results are shown page by page.
4. The tools page searches the successful cache of enabled connections visible in the current scope, not the tools of every uninstalled connector in the marketplace. Without a selected workspace, only global connections are shown.
5. If there are no results, first clear the filters and confirm that the connection is enabled, the scope is correct, and at least one discovery has succeeded; the first discovery may still be pending.

### 5.2 Viewing parameters and source

Each result displays the connector, connection, service, most recent discovery status, and last successful cache time. Click "Parameter details" to see the type, required flag, description, enums, and nested structure.
Complex references, combined rules, or oversized structures will indicate summary limits; you can expand "Raw Schema (security cache)" to keep viewing. The raw Schema here is still the security-redacted cache; it excludes removed defaults/examples and does not guarantee that over-limit fields are preserved. This page does not execute tools.

### 5.3 Discovery status and the last successful cache

"Not yet discovered" means there is no current discovery status yet; "Host status unknown" means the host state cannot be confirmed; "Recently discovered successfully/failed" only represents the most recent discovery and does not guarantee the result of a subsequent invocation.
On failure, the existing last successful tool cache can still be viewed; it will be flagged as stale after 24 hours. Without a successful record there is no cache to provide, and a successful empty list does not necessarily indicate a fault. Reconfiguring, disabling, or disconnecting a connection may make the previous results no longer visible.

### 5.4 Check connection and rediscover

Expand "Connection status and troubleshooting" and first read the stage and suggestions. "Check connection" runs a health check for that connection; "Rediscover tools" re-fetches that connection's tool metadata. Neither is a trial run of the target tool, and neither guarantees automatic repair.
In-progress operations on the same connection are coalesced, and frequent operations have a cooldown; actions on the tools page cannot bypass an effective rate-limit wait. For authentication failures, go to the installed page to update credentials or re-authorize.
Healthy background discovery becomes due after five minutes; while the page holds the SSE connection, due items are checked on schedule, ordinary faults back off exponentially, rate limiting waits according to Retry-After, and authentication failures pause automatic retries. Do not mistake "refresh tools view" for forcing access to all services; it only refreshes the cached view.

## Integration Checks

Confirm that the Markdown anchors actually render as navigable, and that the scope/cache wording is consistent between languages. Avoid overwriting the new hero from the natural search task; wait until image acceptance before changing image links and asset lists. It is recommended to update the user guide first, then sync the README, and finally update the marketplace materials.