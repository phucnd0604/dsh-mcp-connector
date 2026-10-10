# MCP Connector 0.2.45 Promotion and Usage Guidance Master Ledger

Last updated: 2026-09-14 (Asia/Shanghai)

## Goals and Boundaries

This round of updates covers the promotion evidence, usage guidance, market copy, screenshot asset specifications, and growth retrospective definitions for already-released features. It does not add any product functionality. `0.2.45` is the campaign fact baseline; the currently deployed production version has advanced to `0.2.46`.

Fixed wording boundaries:

- Do not promise improved default rankings, do not describe the cache as still callable while offline, do not interpret Registry entry counts, npm download counts, or clone counts as user counts, and do not claim that all third-party connectors are free.
- Tool search reads the last successful security cache; it does not execute the target MCP tool. A visible cache does not mean the service is currently callable.
- Historical screenshots must be labeled with their source version; catalog, connection, and tool counts from a credential-less harness must not be treated as production statistics.

## Status of the Four Tasks

| Sub-task | Session | Exclusive output directory | Current status |
|---|---|---|---|
| Search closure | `01a051f7-eeba-7742-a353-7d8aa086ea31` | `marketing/campaign-0.2.45/search-closure/` | Complete: feature evidence, tutorial patch, acceptance steps, and acceptance criteria for the three promotional assets are all in place; the three assets were committed on 2026-09-14 |
| Natural search conversion | `01a051f8-b966-77a2-94ea-ab0e538724e0` | `marketing/campaign-0.2.45/natural-search/` | Development and assets complete: bilingual hero, metadata, 43-second demo, and three new images are integrated; the D+7/D+14 retrospective runs on schedule |
| Plugin market listing ranking optimization | `01a051ec-d92f-7e00-a0d6-ffb185584bb4` | `marketing/campaign-0.2.45/market-listing/` | Description update and post-launch re-verification are complete; the four core terms are currently ranked 1st, `mcp server` is 15th, listed as a follow-up relevance optimization |
| Data-source MCP auto-discovery | `01a051f9-1a95-7980-820e-95943e80872b` | `marketing/campaign-0.2.45/data-evidence/` | This round's README, machine snapshot, and three-scenario runbook are complete; testing against a dedicated blank Notion workspace still has no evidence, so it is not written up as accepted |

## Shipped Integrations

- Product docs and metadata: Connector [PR #74](https://github.com/duhu2000/dsh-mcp-connector/pull/74), merged 2026-09-13, commit `2abf622d422a458b50b6d5111cb57b65c6cc120a`.
- Official release: Connector [PR #75](https://github.com/duhu2000/dsh-mcp-connector/pull/75), merged and released as [`v0.2.46`](https://github.com/duhu2000/dsh-mcp-connector/releases/tag/v0.2.46) on 2026-09-13, commit `862ec2f4a7c3e179160d05618651178a9ba48aff`.
- awesome-dsh-plugin description: [PR #4982](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/4982), merged 2026-09-13, commit `44483edfb835af0d217398deb7c42bc619fd2974`; the public entry has been synced to `0.2.46`.
- The short descriptions, versions, keywords, and Topics for npm and GitHub About have passed the `npm run marketing:check:live` consistency check.
- Public Registry as of 2026-09-11: 106 entries; after merging with the 4 unique bundled cards, the market has 110 cards across 9 categories with 6 featured. For dynamic counts, defer to the refreshed client badge and `catalog-stats.json`.

## 2026-09-14 Search Re-verification

Environment: the actual local DSH Web, `dshmarket@1.46.1`, the discovery page "All" category, approximately 3.6k entries.

| Query | Current position | Conclusion |
|---|---:|---|
| `mcp` | 1 | Core term passes |
| `mcp连接器` | 1 | Product name passes |
| `连接器` | 1 | Chinese category term passes |
| `连接管理` | 1 | High-intent feature term passes |
| `mcp server` | 15 | Dropped from the 5th-place baseline of `dshmarket@1.38.1`; indexing is healthy, English relevance needs separate optimization, and it does not block the current assets from shipping |

Default ranking is determined by market signals such as download counts; do not promise direct improvement through copy changes.

## Asset Completion Status

- Added `docs/screenshots/05-unified-tool-search.png`: cross-connection search, source, discovery failure, and the last successful cache.
- Added `docs/screenshots/06-tool-parameters.png`: required fields, types, enums, nested structures, and safe Schema.
- Added `docs/screenshots/07-connection-diagnostics.png`: connection status, failure reasons, suggestions, and two recovery actions.
- Rebuilt `docs/demo.gif`: 43 seconds, 960×540, showing in order the market, details, tools, unified search, parameters, and diagnostics.
- `01`–`04` continue to be retained as `v0.2.37` historical market snapshots; `05`–`07` and the GIF come from the current `v0.2.46` harness. Sources and hashes for all of them are recorded in `docs/screenshots/assets.json`.

## Metrics and Retrospective

D0 (2026-09-12) baseline: npm downloads in the last 30 days 10,991 (not a user count); GitHub 20 Stars, 3 Forks, 1 Watcher; 14-day views 2,361 / 1,161 unique, clones 1,294 / 240 unique.

2026-09-14 rolling observation: GitHub 22 Stars, 3 Forks, 1 Watcher; rolling traffic as of 2026-09-12 is views 2,415 / 1,202 unique and clones 1,394 / 259 unique. This observation does not replace the fixed-window retrospective.

| Retrospective | Due date | Current status | Execution requirement |
|---|---|---|---|
| D+7 | 2026-09-19 | Not yet due | Capture npm/GitHub/traffic using the same definitions as D0, compute the net change, and record channel changes |
| D+14 | 2026-09-26 | Not yet due | Repeat the retrospective with the same definitions, distinguishing cumulative downloads, window downloads, page views, and first-time contributions |

## External Distribution and Media Registration

- External catalogs still have version/source drift, which is deduplicated and tracked centrally in [Issue #69](https://github.com/duhu2000/dsh-mcp-connector/issues/69); it will not be closed until it has fully converged.
- The user has confirmed that published coverage exists, but the repository previously stored no canonical URLs for the CSDN, Sohu, Tencent News, or other articles. The new [`PUBLICATION-REGISTER.md`](PUBLICATION-REGISTER.md) serves as the single entry point for version, image, and copy synchronization; until URLs are registered, do not claim that every media article body has been updated.
- The Notion scenario still lacks test evidence from a dedicated blank workspace and remains a non-blocking operational TODO.

## Current Exit Status

- [x] The developable outputs of all four sub-tasks are complete and integrated.
- [x] The bilingual README, npm/GitHub metadata, and the awesome-dsh-plugin description are published at `0.2.46`.
- [x] The three new promotional screenshots and the 43-second demo have been generated, redacted, and registered.
- [x] Re-verification of the four core high-intent terms in DSH Market currently returns 1st place.
- [x] `npm run check` passes completely: 250 tests, 75 release files; npm/GitHub live marketing metadata is consistent.
- [ ] `mcp server` dropped from 5th to 15th; this must be handled as the next round of search relevance optimization rather than falsely reported as a pass.
- [ ] External catalog [Issue #69](https://github.com/duhu2000/dsh-mcp-connector/issues/69) has not converged.
- [ ] D+7 (2026-09-19) and D+14 (2026-09-26) have not yet reached their due dates for execution.
- [ ] Media article URLs are still pending registration; only after registration can each article's version, screenshots, and install copy be verified.