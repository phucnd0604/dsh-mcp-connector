# Feature Promotion Evidence Checkpoint

Date: 2026-09-13. Status: evidence and draft delivery; this is not a record of a new round of real page acceptance.
Fixed version: 0.2.45, release commit 82d240601df73b8e704124100ec5771a0cd5514a. Local development commit 09a19e9 was once verified to have a code tree identical to the release commit.
Sources: [PR #71](https://github.com/duhu2000/dsh-mcp-connector/pull/71), [PR #72](https://github.com/duhu2000/dsh-mcp-connector/pull/72), [PR #73](https://github.com/duhu2000/dsh-mcp-connector/pull/73).
Release records: [0.2.43](https://github.com/duhu2000/dsh-mcp-connector/releases/tag/v0.2.43), [0.2.44](https://github.com/duhu2000/dsh-mcp-connector/releases/tag/v0.2.44), [0.2.45](https://github.com/duhu2000/dsh-mcp-connector/releases/tag/v0.2.45).
All code and test paths below are relative to the repository root and can be verified at the above pinned commit.

| Capability/version | Code and test evidence | Facts that may be promoted | Boundaries that must be preserved |
|---|---|---|---|
| SSE status notifications, 0.2.43 / #71 | lib/status-events.js; test/status-events.test.mjs | The page updates on status events | Not a continuous health probe, does not observe every tool call; events contain no credentials |
| Last successful cache, 0.2.43 / #71 | lib/tool-catalog-cache.js; the tool cache tests in test/plugin-flow.test.mjs | Even if discovery fails, the previous tool metadata can still be viewed | Not an offline invocation; there is no cache before a successful discovery, and config changes/disconnects invalidate it |
| Background discovery coverage, 0.2.44 / #72 | lib/index.js; the "background discovery covers manual, JSON, and catalog connections" case in test/plugin-flow.test.mjs | Discovery works without opening the details page first | Host capability, service availability, and authorization are still prerequisites |
| Unified tool search, 0.2.45 / #73 | lib/index.js:2713; browseToolCatalog in lib/tool-catalog-cache.js; test/plugin-flow.test.mjs:206 | Unified retrieval over the cache of currently visible, enabled connections, with exact name priority and pagination | Does not search all uninstalled catalog tools; without a workspace it is global only |
| Connection/service/status filters, 0.2.45 / #73 | ui/index.html:1208; the tool browsing API tests above | Narrow the results by connection, service, and most recent discovery status | Status is not a guarantee of real-time call success; search and filtering do not request the target service |
| Readable parameters, 0.2.45 / #73 | ui/index.html:996; the "parameter summary preserves required, nested, and constraints" case in test/ui.test.mjs | Type, required flag, enums, constraints, and nested summary | A summary of complex rules is not the complete rules; the Raw Schema refers to the security cache rather than unredacted original text |
| Source/cache time, 0.2.45 / #73 | ui/index.html:1231–1232; the tool browsing API tests | Displays the connector, connection, service, and last successful time | Marked stale after 24 hours; the cache listing has a capacity limit |
| Per-connection diagnostics and rediscovery, 0.2.45 / #73 | lib/index.js:2736; the tool browsing API tests | Check connection, rediscover tools, and diagnostic suggestions | Does not execute the target tool, does not guarantee automatic repair; five-second cooldown, in-flight coalescing |
| Background backoff, 0.2.45 / #73 | lib/discovery-policy.js; test/discovery-policy.test.mjs; lib/index.js from line 3158 | At most two background tasks run concurrently; healthy tasks expire after five minutes; failures back off | While the page holds the SSE connection, expired items are checked every 30 seconds; this is not precisely timed or permanent background polling |

## Precise Backoff Definition

Ordinary failures grow exponentially from 30 seconds with a local cap of 15 minutes; 429 responses start at one minute and combine with Retry-After. Retry-After parsing is capped at 24 hours, so unrestricted strict compliance with arbitrary values cannot be claimed. Authentication failures pause automatic retries and require updating credentials/re-authorizing or checking recovery. Manual actions on the tools page cannot bypass an effective rate-limit wait; it also cannot be over-generalized to claim that all legacy endpoints forbid manual retries.

## Existing Verification and Outstanding Items

Before the 0.2.45 release: 248 tests passed on Linux Node20/22/24 and Windows Node24, along with the candidate package check; 72 release files passed the allowlist and sensitive-content scan. Browser acceptance was 6 mock services/750 mock tools from a credential-less harness, not a real tool count. "Six healthy connections, 126 down to 18 times in ten minutes" is a deterministic scheduling model, not a production performance measurement.
The user has confirmed deployment; this checkpoint did not re-test their real profile. TODO: the three new promotional images and item-by-item acceptance of the new DSH tools page.

The count definitions cite the master ledger's frozen snapshot: Registry 106, bundled 6, duplicates 2, merged 110, bundled-unique 4, 9 categories, 6 featured. This data comes from the data evidence sub-task and does not masquerade as an online measurement taken on this task's day; re-confirm it at release time. Notion hands-on testing remains a TODO.