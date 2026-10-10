# v0.2.45 Promotional Case Recording Runbook

This runbook is used to reproduce the three case categories "developer tools, office collaboration, data analysis" in a clean test environment. All cases are read-only by default and never perform paid, send, create, modify, or delete operations.

## Unified Recording Rules

1. Use `dsh-mcp-connector` v0.2.45, and click "Refresh connector catalog" first.
2. Screenshots must simultaneously show the connector name, connection status, total tool count or tool search results, the question, and the answer with sources.
3. Before connecting, record the authorization method and runtime prerequisites; after connecting, record real-time tool discovery, and do not treat the Registry's static description as evidence of runtime success.
4. Do not display accounts, email addresses, real workspace/project names, Tokens, authorization codes, Cookies, local absolute paths, customer data, or personal information.
5. When encountering an unreachable service, authorization failure, rate limiting, or tool changes, keep the error category and timestamp, and do not claim the product is permanently available.

## Case A: SHOPLINE Official Developer Documentation Search

### Goal

Demonstrate that a user can enter the SHOPLINE official developer resource lookup through unified tool search and produce an API conclusion with sources.

### Prerequisites

- Connector: `shopline-developer-mcp`
- Transport: stdio
- Command: `npx -y @shoplineos/shopline-developer-mcp@1.1.0`
- Authentication/cost: the Connector has no authentication; this does not imply a promise that other SHOPLINE business services are free.
- Local requirements: Node.js/npm; access to npm and the SHOPLINE official developer documentation.

### Recording Steps

1. Search the marketplace for "SHOPLINE Developer MCP"; after connecting, confirm that 9 tools are discovered.
2. Enter `GraphQL` in unified tool search and confirm that `get_graphql_schema` and `validate_graphql_codes` can be found.
3. Send:

   > Look up the schema in SHOPLINE Storefront GraphQL for querying product title, price, and inventory, and generate a read-only query that passes validation; explain the API version and sources, and do not invoke the feedback tool.

4. The accepted answer contains: the tools used, official source links, GraphQL code, validation results, and a version/currency note.

### Safety Gates

- Do not invoke `shopline_mcp_feedback`; it sends content to SHOPLINE.
- Do not claim that this Connector can read real store products or orders; the current tool positioning is developer documentation, API definitions, Schema, and code validation.
- The existing read-only acceptance only covers 1.1.0; after a package version upgrade it must be re-accepted.

## Case B: Notion Workspace Read-Only Progress Summary

### Goal

Demonstrate that after a unified OAuth connection, the user's authorized office knowledge base can be searched and read while the "read-only" boundary is maintained.

### Prerequisites

- Connector: `notion`
- Transport: officially hosted Streamable HTTP
- Endpoint: `https://mcp.notion.com/mcp`
- Authentication: OAuth 2.0 PKCE
- Cost/plan: the connector catalog does not promise that all Notion capabilities are free; cross-Slack/Google Drive/Jira source search requires Notion AI, and advanced cross-data-source queries may additionally require an Enterprise/Business plan or similar.
- Test data: prepare 3 fictional pages in a dedicated blank workspace, for example "Release goals", "Risk list", and "Release to-dos".

### Recording Steps

1. Connect Notion, selecting only the dedicated test workspace during OAuth.
2. Expand the tool details and confirm real-time discovery of `notion-search` and `notion-fetch`; depending on client conventions, tool names may be displayed with the prefix removed as `search` and `fetch`.
3. Send:

   > Use Notion MCP to search the workspace for pages related to the "v0.2.45 release", summarize progress, risks, and to-dos, and attach the page titles; do not create, update, or move pages, and do not post comments.

4. The accepted answer references only test pages, groups them by progress/risks/to-dos, and does not trigger any write tool.

### Safety Gates

- The current Registry card's `probeStatus` is `unverified`; until the TODO in this runbook is completed, this case must not be written up as "verified in practice on DSH".
- The permissions of the official MCP are equivalent to those of the current Notion user in the authorized workspace; recording must not connect a production workspace.
- Do not invoke write tools such as `notion-create-pages`, `notion-update-page`, `notion-move-pages`, or `notion-create-comment`.
- Official rate limits and plan rules may change; when rate limited, reduce parallel searches or retry later.

## Case C: World Bank Data360 Cross-Country Development Indicator Comparison

### Goal

Demonstrate that a password-free public MCP can first discover indicators, verify definitions and coverage, and then fetch data and produce a verifiable charting plan.

### Prerequisites

- Connector: `world-bank-data360`
- Transport: officially hosted Streamable HTTP
- Endpoint: `https://maimcpext.worldbank.org/ext/data360/mcp`
- Authentication/cost: the current public endpoint is configured as password-free; this does not mean other World Bank internal/APIM deployments are authentication-free, nor does it mean all derived services are permanently free.
- Local requirements: no stdio runtime needed; requires access to World Bank MCP and the Data360 API, and generating chart URLs additionally depends on the Charts API.

### Recording Steps

1. Search the marketplace for "World Bank Data360"; after connecting, confirm that 15 tools are discovered.
2. Enter `search`, `disaggregation`, `compare`, and `viz` respectively in unified tool search, and confirm that the corresponding tools can be discovered.
3. Send:

   > Compare how per-capita GDP and the share of population below the international poverty line changed from 2014 to the latest available year for Indonesia, Malaysia, the Philippines, Thailand, and Vietnam; retrieve the indicators first and verify country and year coverage, then generate a year-by-year comparison table and summarize the trends, listing indicator definitions, sources, units, methodological limits, and missing values; do not guess database_id or indicator_id.

4. The accepted invocation sequence shows at least: `data360_search_indicators` → `data360_get_disaggregation` → `data360_get_data` or `data360_compare_countries`; if a chart is generated, `data360_get_viz_spec` is called.
5. The accepted answer preserves indicator definitions, sources, units, query/latest-available times, missing values, and comparison limits.

### Safety Gates

- Do not pre-fill or guess `database_id` or `indicator_id`; they must come from search results.
- Do not write correlation as causation, and do not hide missing years or differences in definitions.
- "Password-free" describes only the public endpoint currently pointed to by the Registry; service rate limiting, maintenance, or network failures will still affect invocations.

## Freeze Decision

| Case | Current evidence status | May be used directly for "verified in practice" promotion |
|---|---|---|
| SHOPLINE | `initialize`, 9-tool discovery, and read-only search completed on 2026-09-11 | Yes, but the test package version and date must be noted |
| Notion | Official documentation and the Registry card have been verified, but there is no real acceptance in a dedicated workspace for this round | Not yet; upgrade the wording only after the TODO is completed |
| Data360 | The Registry is `pass`, and the official page lists 15 tools and the public endpoint | It can be described as "officially supported / cataloged"; describe "verified in practice this round" only after recording |