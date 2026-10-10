# v0.2.45 Data Source Definitions and Scenario Evidence

Status: **checkpoint, reviewable**  
Verification time: 2026-09-12 21:52 CST (2026-09-12 13:52 UTC)  
Applicable version: `dsh-mcp-connector` v0.2.45

Companion materials: [`catalog-evidence.json`](catalog-evidence.json) is a machine-readable statistics snapshot; [`SCENARIO-RUNBOOK.md`](SCENARIO-RUNBOOK.md) contains the recording and acceptance steps for the three cases.

## 1. Count Definitions Cleared for Public Use

### Durable version (recommended for store short descriptions)

> MCP Server and MCP Connector marketplace, cataloging over a hundred MCP Connectors with continuous updates; unified discovery, authorization, and connection management.

### Precise version (for README, release announcements, or campaign pages that carry a statistics date)

> As of 2026-09-11, the public Registry has published 106 connectors; after merging and deduplicating with the bundled cards, the default marketplace offers 110 browsable connector cards covering 9 business categories.

### The three numbers must be expressed separately

| Metric | Verified value | Meaning |
|---|---:|---|
| Public Registry | 106 | Published public Connector Descriptors in `catalog.json`; all 106 IDs are unique. |
| Published bundled cards | 6 | 4 Qichacha cards, PKULaw, Wind. |
| Duplicate with Registry | 2 | PKULaw and Wind also exist in the public Registry. |
| Unique bundled cards | 4 | Only the 4 Qichacha cards provided solely with the bundle. |
| Default marketplace after merge and dedupe | 110 | `106 + 6 - 2 = 110`, equivalently `106 + 4 = 110`. |
| Business categories | 9 | Enterprise data, financial investment, legal and compliance, developer tools, office collaboration, research and analysis, design and creativity, productivity tools, other. |
| Featured cards | 6 | 4 Qichacha cards, PKULaw, Wind. |

Do not write this as "110 MCP data sources" or "110 datasets"; what is being counted here is connector cards. Catalog entry counts are also not equal to user counts, connection counts, invocation counts, or download counts.

## 2. Evidence Chain and Re-verification Method

- GitHub Registry `main`: `f1cbed41c3277a2274bc8633953b9096b6b7b56b`
- Commit time: 2026-09-11T04:46:48Z
- v0.2.45 Release commit: `82d240601df73b8e704124100ec5771a0cd5514a`
- Live statistics: [catalog-stats.json](https://github.com/duhu2000/dsh-mcp-connector-registry/blob/main/catalog-stats.json)
- Live catalog: [catalog.json](https://github.com/duhu2000/dsh-mcp-connector-registry/blob/main/catalog.json)
- Registry `catalog.json` Git blob SHA: `ba7690760adcaff3e0db884053af3974c2746c2b`
- SHA-256 of the content read this time: `bd101122a52fa7f8e20de1040203fedd2c70aff3a6a639e2c02a484ff7e0e41d`
- SHA-256 of the Registry statistics content: `91a178835b4b7cce51b61cf0d7be33467e8818a304d2c7f82b63453d0eb5fb78`
- Product bundled catalog: `catalog/catalog.json`, 6 published cards; of these, `pkulaw-legal` and `wind-stock-data` duplicate the Registry, while `qcc-company`, `qcc-legal`, `qcc-tender`, and `qcc-document` are unique to the bundle.
- Statistics generation logic: the Registry's `scripts/build-catalog-stats.mjs` uses `Registry entry count + bundledUniqueConnectorIds` to compute the marketplace count, and validates that bundled unique IDs must not appear in the Registry.

Re-verification commands (read-only):

```bash
gh api repos/duhu2000/dsh-mcp-connector-registry/commits/main \
  --jq '.sha + "\n" + .commit.committer.date + "\n" + .commit.message'

gh api 'repos/duhu2000/dsh-mcp-connector-registry/contents/catalog-stats.json?ref=main' \
  --jq '.content' | tr -d '\n' | base64 -d
```

## 3. Authorization, Cost, and Availability Boundaries

- 110 is the deduplicated card count in the default public marketplace; it does not mean every service is already connected, free, or free of authorization requirements.
- A specific connector may require OAuth, an API Key, a Bearer Token/PAT, a paid subscription, or a local runtime environment such as Node/npm.
- What the Registry and the bundled cache guarantee is that "the catalog is still browsable"; when the remote service is unreachable, authorization has expired, or the local runtime is missing, the tool may still not be callable.
- Third-party service availability, quota, pricing, data licensing, geographic restrictions, and tool lists change over time; the provider's current documentation and real-time tool discovery after connecting are authoritative.
- `probeStatus: pass` only proves that the recorded protocol/read-only acceptance passed at the corresponding time; it is not a permanent SLA, and `unverified` does not mean the service is unavailable.
- Any tool that writes, deletes, sends feedback, creates calendar entries, or modifies workspace content must obtain explicit user consent before execution; promotional examples default to read-only tasks.

## 4. Three Reproducible Promotional Scenarios (first draft)

### A. Developer tools: SHOPLINE Developer MCP

- Connector: `shopline-developer-mcp`, official stdio package `@shoplineos/shopline-developer-mcp@1.1.0`.
- Discoverable tools: 9 in total, including `search_shopline_docs`, `read_full_docs`, `search_admin_rest_endpoints`, `get_admin_rest_endpoint_detail`, `get_graphql_schema`, `validate_graphql_codes`, etc.
- Sample question: `Find the Admin REST API endpoint, required fields, and an example needed to create a SHOPLINE product; search the official documentation first, then provide source links, and do not invoke the feedback tool.`
- Prerequisites: no business credentials required; a working local Node.js/npm is needed, plus network access to npm and the SHOPLINE official developer documentation.
- Existing evidence: `initialize`, `tools/list`, and the read-only `search_shopline_docs` invocation passed on 2026-09-11; Server 1.1.0, MCP protocol 2025-06-18.
- Limits: results depend on the pinned package version and the current state of the official documentation; `shopline_mcp_feedback` sends content to a third party, so this example must not invoke it.

### B. Office collaboration: Notion

- Connector: `notion`, Notion's official hosted Streamable HTTP endpoint `https://mcp.notion.com/mcp`.
- Officially discoverable tools: `notion-search`, `notion-fetch`, `notion-create-pages`, `notion-update-page`, `notion-get-comments`, etc.; this example uses only the search and read tools.
- Sample question: `Use Notion MCP to search the workspace for pages related to the "v0.2.45 release", summarize progress, risks, and to-dos, and attach the page titles; do not create, update, or move pages, and do not post comments.`
- Prerequisites: complete OAuth 2.0 PKCE, select and authorize the target Notion workspace; no local stdio runtime is needed.
- Limits: access scope matches the current Notion user and workspace authorization; the connector's current catalog status is `unverified`, so before any demo you must complete connection and read-only tool discovery in a dedicated test workspace; Notion API and per-tool rate limits, and Notion AI/plan capabilities, may affect cross-connection source search and advanced queries.
- Official resources: [Notion MCP overview](https://developers.notion.com/guides/mcp/overview), [supported tools](https://developers.notion.com/guides/mcp/mcp-supported-tools), [connection instructions](https://developers.notion.com/guides/mcp/get-started-with-mcp).

### C. Data analysis: World Bank Data360

- Connector: `world-bank-data360`, the World Bank's official public Streamable HTTP endpoint `https://maimcpext.worldbank.org/ext/data360/mcp`.
- Officially discoverable tools: 15 in total, including `data360_search_indicators`, `data360_get_metadata`, `data360_get_disaggregation`, `data360_get_data`, `data360_compare_countries`, `data360_rank_countries`, `data360_get_viz_spec`, etc.
- Sample question: `Compare how per-capita GDP and the share of population below the international poverty line changed from 2014 to the latest available year for Indonesia, Malaysia, the Philippines, Thailand, and Vietnam; retrieve the indicators first and verify country and year coverage, then generate a comparison table that preserves definitions, sources, units, methodological limits, and missing values.`
- Prerequisites: the current public endpoint is configured as password-free with no local runtime; network access to the World Bank MCP and the Data360 API is required.
- Limits: do not guess `database_id` or `indicator_id`; search first, then check grouping/years, and only then fetch data or generate charts. Data coverage, update frequency, and missing values vary by indicator, and chart URLs additionally depend on the optional Charts API. The World Bank documentation also states that other hosted/internal environments may require Bearer or Azure AD, so "the public endpoint is password-free" must not be generalized to all deployments.
- Official resources: [World Bank Data360 MCP](https://worldbank.github.io/data360-mcp/).

## 5. New Connector Contribution Entry Point

- Recommended: submit a Connector PR to [dsh-mcp-connector-registry](https://github.com/duhu2000/dsh-mcp-connector-registry).
- If you are unfamiliar with the Descriptor: file a [Connector request issue](https://github.com/duhu2000/dsh-mcp-connector-registry/issues/new?template=connector-request.yml); an issue only represents a cataloging request and does not equal automatic listing.
- Complete guide: [Third-party connector onboarding guide](https://github.com/duhu2000/dsh-mcp-connector-registry/blob/main/docs/ONBOARDING.md).
- A PR submits only public metadata and public URLs; real Tokens, API Keys, passwords, Cookies, Client Secrets, authorization codes, or authentication Headers with values must not enter the Registry.
- A new card requires submitting `connectors/<id>.json`, and the maintenance process must fill in `candidates/records/<id>.json`, official resource/licensing verification, manual approval, and a run acceptance summary free of credentials or personal data; locally run `npm ci --legacy-peer-deps`, `npm test && npm run validate && npm run assets:check`.
- After a PR is merged, CI rebuilds the catalog and statistics and clears the CDN cache; users click "Refresh" in the marketplace to get the new card, with no need to republish the plugin npm package.

## 6. TODO (before freeze)

- [ ] Complete OAuth, `tools/list`, and the read-only search demo in a dedicated blank Notion test workspace, to avoid miswriting official documentation capabilities as verified facts about the current client.
- [ ] Prepare one redacted result screenshot or short GIF for each of the three scenarios; screenshots must not contain real workspace names, accounts, Tokens, customer data, or personal information.
- [ ] Read `catalog-stats.json` again before publishing; if the numbers change, update the precise version accordingly, while the durable short description can continue to use "over a hundred".