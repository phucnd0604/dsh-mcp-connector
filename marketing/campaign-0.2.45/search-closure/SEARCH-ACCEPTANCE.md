# Search and Troubleshooting Acceptance Specification

Date: 2026-09-13. Status: a pending-execution specification; the automated tests that already exist do not mean that all the real page cases below have passed.

## Record and Environment

Record each time: date/timezone, DSH/plugin version, profile, workspace scope (use an alias externally), catalog snapshot, the literal query, filter values, cache time, the action, the actual result, pass/fail/not tested, and screenshot number. Do not collect Tokens, Headers, real query results, or sensitive local paths.
Phase A: credential-less harness + local mock HTTP service; Phase B: a user-authorized real DSH separate acceptance environment. Do not actively induce 429s on real services, revoke credentials, or retry at high frequency.
Unified tool search and plugin marketplace search are recorded separately; the former searches the cache of enabled visible connections, while the latter searches plugin entries.

| ID | Action | Expected |
|---|---|---|
| T01 | Both connections have tools; search an exact name, with prefix/description matches as distractors | The exact name ranks ahead of weaker matches; same-name entries from different sources are retained |
| T02 | Search for a word present in the title, present in the description, and absent | Matches are explainable; a no-result state is indicated; search does not trigger a request to the target MCP |
| T03 | Select a connection, then a service, then clear the filters | Only the corresponding source; clearing restores; the pagination count is consistent |
| T04 | Select respectively not-yet-discovered, host-unknown, recently successful, recently failed | Filter by most recent discovery status; do not treat unknown as success |
| T05 | Record a successful cache, simulate a timeout, then search and open parameters | The cache is still readable, the failure state is retained, and the timestamp is not falsely refreshed |
| T06 | Never successfully discovered; successful empty list; simulate a cache older than 24 hours | The three states are expressed separately; an empty list is not treated as an offline cache |
| T07 | Precisely locate the parameters of a same-name tool | The source is correct; required/type/enum/nested are readable; combined structures are indicated; the safe raw Schema can be expanded |
| T08 | Simulate recovery, click rediscover; then check connection | Only that connection is accessed, the state syncs after completion; `tools/call` is not invoked |
| T09 | Rapid repeated clicks, simulate 429 Retry-After=600 | In-flight coalescing/five-second cooldown; actions within the rate-limit wait are rejected without increasing requests |
| T10 | Simulate ordinary failures, authentication failures, and recovery | Exponential backoff; authentication pauses; success resets. Test only in the mock environment |
| T11 | Project-A-only data and global connections; switch to B, no workspace, disabled or disconnected | A-only data does not leak; no workspace means global only; old responses do not revive an invalidated cache |
| T12 | Results exceed 20 items; after paging, change the query/filters | The page number resets with no duplicates or omissions; record the deterministic ordering |
| T13 | Keep the page SSE open; continuously observe healthy connections | Expiry scheduling does not create an event-request loop; at most two background tasks; behavior after unsubscribing matches the implementation |

## Automation Basis and Commands

Run in the repository `node --test test/discovery-policy.test.mjs test/ui.test.mjs`, plus `node --test --test-name-pattern='tool browsing API|background discovery' test/plugin-flow.test.mjs`; the full gate is `npm run check`. The mock HTTP tests require local listening to be allowed.
The request count is tallied by the test server; do not substitute the page's smoothness feel for it. The scheduling model figures of 18/126 are model task counts and must not be promoted as an actual performance improvement percentage.

## Real DSH Re-verification

First confirm the deployed version and scope, and use at least two connections that already have authorization; execute the side-effect-free parts of T01–T04, T07, T08, and T12. Failures, 429s, credential invalidation, and cross-workspace deletion/changes are only performed in an approved isolated test environment; otherwise mark them as not tested.
Do not write a Mock success as a real service success; untested items must not be treated as passing by default.
TODO: record real tool name/description samples and actual results, and keep redacted screenshots. There are currently no new real acceptance results.

## Plugin Marketplace Regression Handoff

The marketplace task executes five terms: mcp, MCP连接器, 连接器, mcp server, 连接管理. Also test the empty-query default sort, and record the language, category, sort, per-page count, plugin marketplace version, and time. Count according to the actual order of the list; a masonry layout must not be ranked based solely on a card's vertical coordinate. Historical #1/#5 cannot serve as a future guarantee; a promotional description change promises no default ranking improvement.