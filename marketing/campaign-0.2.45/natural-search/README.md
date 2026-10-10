# MCP Connector v0.2.45: Natural Search and Conversion Copy Pack

Status: the copy and D0 metric baseline are complete; the public copy shipped with `0.2.46`, the three new screenshots and the 43-second demo were completed on 2026-09-14, and the D+7/D+14 retrospectives are pending their due dates.

Last updated: 2026-09-14 (Asia/Shanghai)

Ship record: Connector [PR #74](https://github.com/duhu2000/dsh-mcp-connector/pull/74) integrated the README/metadata, release [PR #75](https://github.com/duhu2000/dsh-mcp-connector/pull/75) produced `v0.2.46`, and awesome-dsh-plugin [PR #4982](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/4982) synced the public marketplace description. This file retains the `0.2.45` campaign baseline; later versions only update the rollout and retrospective status.

## 1. Frozen Facts and Expression Boundaries

- Product version: `dsh-mcp-connector@0.2.45`
- Merge commit: [`82d2406`](https://github.com/duhu2000/dsh-mcp-connector/commit/82d240601df73b8e704124100ec5771a0cd5514a)
- Product PR: [#73](https://github.com/duhu2000/dsh-mcp-connector/pull/73)
- Release: [`v0.2.45`](https://github.com/duhu2000/dsh-mcp-connector/releases/tag/v0.2.45)
- As of 2026-09-11, the public Registry has published 106 connector descriptions; after merging and deduplicating with the bundled cards, the default marketplace offers 110 browsable connector cards covering 9 categories, with 6 featured. Dynamic page counts defer to the client badge after a refresh.
- The tools page search reads the "last successful security cache" for connections that are enabled within the current scope, and supports filtering by connection, service, and most recent discovery status as well as pagination; search/filtering does not request the target MCP and does not execute the target tool.
- Parameter details show the type, required flag, enums, common constraints, and a nested summary, and retain a "Raw Schema (security cache)" entry point; this is not the unredacted full server-side text.
- "Check connection" and "Rediscover tools" are per-connection diagnostic actions, not tool executions, and do not promise one-click automatic repair.
- The background scheduler runs on expiry and status change: healthy connections expire after five minutes; ordinary failures back off exponentially from 30 seconds up to a maximum of 15 minutes; 429 responses combine with `Retry-After`, and authentication failures pause automatic retries. This must not be written up as a permanent real-time probe or as "refreshes precisely every five minutes".
- A viewable cache does not mean the service is currently callable; the catalog cache / bundled fallback also does not mean tools are callable while offline.
- Connector card counts, npm download counts, and clone counts are not user counts; third-party connectors are not all free or free of authorization requirements.

The fixed feature evidence and tutorial patch are in:

- [`../search-closure/FEATURE-EVIDENCE.md`](../search-closure/FEATURE-EVIDENCE.md)
- [`../search-closure/README-PATCH.md`](../search-closure/README-PATCH.md)
- [`../search-closure/SCREENSHOT-ACCEPTANCE.md`](../search-closure/SCREENSHOT-ACCEPTANCE.md)

Of these, `README-PATCH.md` only covers the tool tutorial section; the hero and the unified marketing positioning are defined by this document. The three new assets and the final demo live in `docs/screenshots/05`–`07` and `docs/demo.gif`.

Unified terminology: `MCP Connector`, `MCP Server`, `tool lookup`, `connection troubleshooting`, `rediscover tools`, `last successful cache time`. If a marketplace has a separate keyword field, the space variant `MCP connector` may be added there.

## 2. Single Copy Source

### 2.1 Core Positioning

**Campaign / hero**

> 100+ MCP connectors, one place to connect MCP servers, search tools across connections, and troubleshoot connections.

**Durable version (not dependent on any specific count)**

> MCP Connector for DeepSeek Harness: connect to MCP servers, search tools across connections, and manage or troubleshoot connections.

### 2.2 Short Description

**English (recommended for both the npm description and GitHub About, 241 ASCII characters)**

DeepSeek Harness MCP Connector: connect servers, find tools across active connections, and troubleshoot discovery. Includes a continuously updated catalog; supports OAuth 2.0 PKCE, API keys, Streamable HTTP/stdio, and mcpServers JSON import.

Note: the current English npm description is 305 characters, and what npm reads online is truncated at roughly 255 characters; the 241-character version above displays in full and puts the user benefit before the protocol names.

### 2.3 Long Description

**English**

MCP Connector helps DeepSeek Harness users connect MCP servers from a continuously updated catalog, then find tools across enabled connections, inspect readable parameters and source metadata, and troubleshoot connection or discovery failures from the same interface. It supports OAuth 2.0 PKCE, API keys, Streamable HTTP/stdio, `mcpServers` JSON import, connection checks, and scoped tool rediscovery.

Tool search reads the last successful sanitized cache and never executes a target tool. A visible cache does not guarantee that the remote service is currently callable. Provider authentication, subscriptions, runtimes, quotas, and data licenses remain provider-specific.

## 3. README Hero and Install Guidance Patch Suggestions

The following are drafts for the central session to copy; they do not directly modify the public README.

### 3.1 English hero

````markdown
# Connect, Find, and Troubleshoot MCP Servers in DeepSeek Harness

> 100+ MCP connectors, one place to connect MCP servers, search tools across connections, and troubleshoot connections.

Connect MCP servers from a continuously updated catalog. Search tools across enabled connections in the current scope, inspect readable parameters, source metadata, and the last successful cache time, then check a connection or rediscover its tools when discovery fails. Supports OAuth 2.0 PKCE, API keys, Streamable HTTP/stdio, and `mcpServers` JSON import.

Tool search reads the last successful sanitized cache and never executes a target tool. A visible cache does not guarantee that the service is currently callable.

## Start in 30 seconds

```bash
dsh plugin --profile web add dsh-mcp-connector
```

Fully quit and restart DeepSeek Harness Desktop after installation or upgrade. For `dsh web`, stop the existing process before starting it again. Open **MCP Connector** from the primary sidebar, or choose **Settings → Plugins → Plugin Configuration → MCP Connector → Open MCP Connector**.

1. Select a connector in **Marketplace** and finish authorization or configuration.
2. Use **Tools** to search across connections and filter by connection, service, or recent discovery state.
3. Inspect parameters and source metadata; when discovery fails, open diagnostics and check the connection or rediscover its tools.
````

## 4. Community Content

### 4.1 English short post

As MCP tools multiply in DeepSeek Harness, three questions become expensive: Where is the tool? What parameters does it need? Why did discovery stop updating?

`dsh-mcp-connector v0.2.45` adds one Tools view to search across enabled connections in the current scope, filter by connection/service/discovery state, inspect readable parameters and source metadata, and run a scoped connection check or rediscovery.

```bash
dsh plugin --profile web add dsh-mcp-connector
```

Search reads a sanitized last-success cache and never executes target tools. Cached visibility is not proof of current callability.

### 4.2 Update Article Outline

Recommended title: **After Connecting an MCP Server, How Do You Find Its Tools and Diagnose Discovery Failures?**

1. Pain point: as the number of connections grows, tools become scattered, parameters are hard to read, and cache state is easily confused with real-time availability.
2. The version's answer: 0.2.45's unified tools page puts search, filtering, parameters, source, cache time, and troubleshooting entry points into a single flow.
3. Three scenarios:
   - You already know the tool name: exact tool name priority quickly locates the source connection and service.
   - You are unsure of the parameters: view the type/required/enum/nested summary, and open the raw safe Schema if needed.
   - Recent discovery failed: keep viewing the last successful cache and diagnostics, then check the connection or rediscover the tools.
4. Honest boundaries: only the cache of connections enabled within the current scope is searched; no tool is executed; a cache does not equal callable; the background is bounded scheduling with backoff.
5. Install and entry points: install command, restart requirement, sidebar, and settings page paths.
6. How to participate: Star, submit a connector, submit a reproducible Issue, or contribute a fix.

## 5. 30–45 Second Demo Script

Target duration: 43 seconds. All mock scenarios must be clearly labeled "Demo data" on screen. Real authorization time is not included in the demo promise.

| Time | Screen | Narration / subtitle |
|---|---|---|
| 0–5s | Open MCP Connector from the sidebar, quickly scan the marketplace and the "Tools" tab | "100+ MCP connectors, one place to connect MCP servers, search tools across connections, and troubleshoot connections." |
| 5–15s | The "Tools" page shows at least two connections/services; enter a natural, non-sensitive keyword and toggle the connection and service filters | "Find tools across connections enabled in the current scope, and filter by connection, service, and recent discovery state." |
| 15–24s | Open a tool's parameter details and show the type, required flag, enums, and one nested structure in sequence; keep the raw safe Schema entry point | "Parameters start with a readable summary; when needed you can still view the security-redacted raw Schema." |
| 24–35s | Enter a controlled timeout state clearly labeled "Demo data"; show source, last successful cache time, diagnostic suggestions, "Check connection", and "Rediscover tools" | "When discovery is abnormal, the cache can still be used to locate the problem; then follow the diagnostics to check the connection or rediscover. The cache does not mean the service is necessarily callable now." |
| 35–39s | Simulate recovery into a success state | "After recovery the status updates accordingly." |
| 39–43s | Install command, Release, and the connector submission entry point | "Install v0.2.45, or submit your own connector." |

Screenshot/screen-recording acceptance requirements:

- Record the product panel at the real 800px width; the desktop marketplace cards must be 2 per row, and the old 3-column assets must not be used.
- The main image uses a success state; a failure image may only use a clearly labeled controlled mock state, and must not present "needs re-authorization" as the main promotional state.
- No Token, API Key, local machine path, real user query, real session, paid account, or unpublished result may appear.
- The "unified tool finding" image must simultaneously show at least two connections/services, the source, and the cache time; a single-service list must not be passed off as a cross-connection search.
- The "understand parameters" image must show the type/required/enum/nested summary and the raw safe Schema entry point.
- The "status and troubleshooting" image must retain the failure label, last successful cache, diagnostic suggestions, and both action entry points; real state must not be altered through post-processing beautification.
- Done: the three new images and the 43-second video both come from the credential-less `v0.2.46` UI harness and passed the hash, dimension, duration, and sensitive-information gates; see [`../../../docs/screenshots/README.md`](../../../docs/screenshots/README.md) for the sources.

## 6. Pre-Promotion Metric Snapshot

Collection time: 2026-09-12 21:44 (Asia/Shanghai). The raw sources are the npm downloads API, the GitHub Repository/Traffic API, the GitHub Release, and a public search snapshot.

| Metric | 2026-08-30 baseline | 2026-09-12 pre-promotion snapshot | Notes |
|---|---:|---:|---|
| npm downloads, last 30 days | 5,406 | 10,991 | Current window `2026-08-13`–`2026-09-11`; includes CI, repeat installs, and cache misses, so it is not a user count |
| GitHub Stars | 8 | 20 | Cumulative snapshot, +12 |
| GitHub Forks | 2 | 3 | Cumulative snapshot, +1 |
| GitHub Watchers | 1 | 1 | Cumulative snapshot |
| Open Issues | 1 | 3 | Currently #29, #53, #69; not directly interpreted as a negative conversion rate |
| GitHub views, rolling 14 days | 646 / 277 unique | 2,361 / 1,161 unique | Current window `2026-08-29`–`2026-09-11` |
| GitHub clones, rolling 14 days | 1,174 / 247 unique | 1,294 / 240 unique | Neither clones nor unique cloners equal installed users |
| Overview top paths | 444 / 268 unique | 1,658 / 1,145 unique | GitHub popular paths API |
| Latest npm / Release | `0.2.29` / `v0.2.29` | `0.2.45` / `v0.2.45` | 0.2.45 was released on 2026-09-12 |

Current main referrers (views / unique): `github.com` 172/48, Google 64/32, Baidu 39/4, `awesome-dsh-plugin.com` 23/10, Bing 19/15, `npmjs.com` 10/5.

Search diagnostic snapshot (Codex Web Search index; the engine/locale are opaque, so this is directional diagnosis only and does not replace formal incognito browser acceptance):

| Query | Best project-related result | Observed position |
|---|---|---:|
| `DeepSeek Harness MCP connector` | No project-owned landing page observed in the top 10 | >10 / not observed |
| `dsh MCP connector marketplace` | A dsh.pub entry; the GitHub repository appears after it | 2; 3 |
| `DeepSeek Harness MCP connector marketplace` | npm package page | 4 |
| `model context protocol connector DeepSeek Harness` | No project-owned landing page observed in the top 10 | >10 / not observed |

Before formal promotion, the central session should still record the first two pages with a fixed engine and locale in a signed-out or brand-new browser; the directional positions above must not be written up as ranking promises.

## 7. D+7 / D+14 Retrospective Method

Suggested retrospective dates: D+7 = 2026-09-19, D+14 = 2026-09-26. Only the method is provided here; no automated task is created.

Record the following each time in the same timezone:

1. The `downloads/start/end` returned by the npm downloads API; comparison against D0 serves only as an installation-intent proxy, because the 30-day windows overlap heavily.
2. Cumulative values and net deltas for GitHub Stars, Forks, Watchers, and Open Issues.
3. GitHub 14-day views/unique, clones/unique, Overview paths, and top referrers; save the raw JSON to avoid rolling-window expiry.
4. Four fixed natural search terms; using a signed-out/brand-new browser, record the engine, locale, date, the project's best result, its position, and the landing page, examining at least the first two pages.
5. First-contribution proxies: first-time Issue/PR counts, first PR merges, and the time from `good first issue` claim to PR.
6. Campaign change log: which README/metadata/screenshot/external entries were actually changed and when they went live; a draft that never shipped cannot be attributed as a growth cause.

Interpretation rules:

- **Discoverability improved**: the project's own pages gain new matches/improve positions on the fixed queries, or unique referrers from Google/Bing/Baidu grow in the same direction.
- **Community intent improved**: Stars/Forks/first Issues or PRs have at least one net increase over the same period, and it is verified as genuine community behavior.
- **Installation intent improved**: the npm 30-day download proxy rises, but it can only be observed together with other signals and must not be converted into a user or real conversion rate.
- **No conclusion**: when only download counts rise, the rolling windows are misaligned, the search index has not updated yet, or there is no clear launch time, do not claim that the copy drove conversion.
- **Next round choice**: at D+7 prioritize fixing non-matching keywords/entry points; at D+14 then decide whether to keep the hero, adjust the title, or switch community channels. Change only one main hypothesis at a time and keep the control record.

Retrospective table:

| Metric | D0 | D+7 | D+14 | Data window/time | Interpretation and limits |
|---|---:|---:|---:|---|---|
| npm downloads (last 30 days) | 10,991 |  |  | 2026-08-13–09-11 | Not a user count |
| Stars / Forks | 20 / 3 |  |  | Cumulative | Record the net increase |
| views / unique | 2,361 / 1,161 |  |  | Rolling 14 days | Save the JSON |
| clones / unique | 1,294 / 240 |  |  | Rolling 14 days | Not installed users |
| Natural search matches | See the table above |  |  | Fixed engine/locale | No default ranking promise |
| First Issue / PR / merged |  |  |  | Same period | Manual deduplication |

## 8. Public File Patch Checklist (for the central session to execute serially)

1. `marketing/metadata.json`
   - Change `npm.description` and `github.description` to the 241-character English short description from 2.2.
   - Change `readme.heroZh/heroEn` to the campaign positioning from 2.1; use a condensed single-paragraph version of the long description from 2.3 for `externalListing`.
2. `package.json`
   - `description` must be exactly identical to `marketing/metadata.json:npm.description`.
3. `README.md`
   - Use section 3 to replace the title, hero, benefit paragraph, and post-install entry points; place the detailed protocol capabilities after the benefits.
   - Keep the explicit boundary around the cache and current callability.
4. `duhu2000__dsh-mcp-connector.yml`
   - Sync the external listing in both languages; keep it single-line, factually accurate, and free of superlative expressions.
5. `scripts/check-marketing-metadata.mjs`
   - The existing assertions hardcode `over one hundred...`, `discover/authorize/manage`, and the unified discovery/authorization/connection-management wording; these should be changed to validate `DeepSeek Harness`, connection/onboarding, tool lookup, and connection troubleshooting from the structured positioning terms, so that new copy is not blocked by an old wording gate.
   - Add an npm description character limit (recommended `<= 250`) to prevent online truncation from recurring.
6. GitHub About
   - Make it consistent with the English short description from 2.2; keep the existing 20 high-intent Topics. This round promises no ranking change.
7. Screenshots and video
   - Done: the three new images/43-second video passed section 5 acceptance, and the central session updated `screenshots.json`, `assets.json`, and the bilingual README references.
8. Integration verification
   - The central branch passed `npm run check` (250 tests, 75 release files), `npm run marketing:check:live`, and the storefront gate for 7 images. `distribution:check:live` accurately reports that the external catalogs have not converged, and tracking continues via Issue #69.

## 9. Delivery and Blockers

- Done: fact freeze, long/short/durable copy in both languages, README hero and install guidance, community short post, article outline, 43-second demo, three tool workbench screenshots, D0 metric snapshot, retrospective method, and public file integration.
- Pending: the fixed-window retrospectives at D+7 (2026-09-19) and D+14 (2026-09-26); per-article review once canonical media article URLs are registered.
- This directory retains the historical delivery description; for the actual public files and external launch status, defer to [`../LEDGER.md`](../LEDGER.md) and [`../PUBLICATION-REGISTER.md`](../PUBLICATION-REGISTER.md).