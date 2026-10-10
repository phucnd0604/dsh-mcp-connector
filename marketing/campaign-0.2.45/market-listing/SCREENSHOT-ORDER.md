# 0.2.45 Marketplace Screenshot Order Recommendation

## Current Gaps

The 4 assets currently declared in `screenshots.json` all come from `v0.2.37`, and the on-screen titles also show `v0.2.37`:

1. Marketplace overview.
2. Connector details and Prompts.
3. The old "tool details" inside a single connector's detail view.
4. `mcpServers` JSON import.

They can demonstrate marketplace browsing, connector details, and JSON import, but they cannot demonstrate 0.2.45's following new capabilities:

- The standalone "Tools" page and unified cross-connection search.
- Connection/service/discovery status filtering and pagination.
- Source, most recent discovery status, and last successful cache time.
- Readable parameters, enums/constraints/nested structures.
- Per-connection diagnostics, "Rediscover tools", and "Check connection".

Therefore, the current screenshots should no longer be treated as completed evidence for 0.2.45 promotion acceptance.

## Recommended Display Order

The marketplace supports 1–8 screenshots. It is recommended that, after the new 0.2.45 assets pass search-closure acceptance, they be combined in the following order:

| Order | Screen | Evidence that must be visible | User intent |
|---:|---|---|---|
| 1 | Unified tool search results | Top version `v0.2.45`, standalone "Tools" page, real search term, cross-connection results, source, last successful cache time | Can I quickly find a tool |
| 2 | Filtering and parameter details | Connection/service/discovery status filters; parameter type, required flag, enums or constraints, expandable nested structure | Can I tell how to use the tool |
| 3 | Connection status and troubleshooting | Per-connection diagnostic suggestions, "Rediscover tools", "Check connection", honest state of a failed or stale cache | Can I locate and recover after a problem |
| 4 | Marketplace overview | Over-one-hundred connector directory, categories, and search; must not show real credentials or present the catalog count as a user count | Which services can I connect |
| 5 | JSON/manual onboarding | `mcpServers` JSON, stdio/HTTP, and local credential prompts | Can I migrate an existing config |
| 6 (optional) | Multi-server connector details | One connector mapping to multiple servers, authorization boundaries, and tool entry points | How to manage complex connections |

If the first round provides only three new assets, the priority order is fixed as "unified tool search → parameter details → connection diagnostics and rediscovery"; the old marketplace overview and JSON import can follow behind, rather than occupying the top three slots.

## Asset Acceptance Rules

- Use a 1280×720 outer viewport and an 800px product panel to avoid inconsistency with the real host layout.
- Must display `v0.2.45`; the `v0.2.37` label must not be carried over.
- Simulated data must be clearly labeled "demo data" or "credential-less mock"; tool names, results, and failure states must not lead readers to mistake them for real customer data.
- No OAuth Token, API Key, Authorization Header, real local paths, user sessions, query results, or other sensitive content may appear.
- Cache screens must simultaneously preserve status semantics, so that "last successful cache" does not look like current service health or callability.
- Parameter details are used to show structure; do not click or execute the target tool.
- Troubleshooting screens may trigger simulated states on a credential-less harness, without changing the real web profile.
- After updating images, recompute the hashes and dimensions in `assets.json` and pass `npm run storefront:check`; the public `screenshots.json` is modified centrally by the master ledger session.

## Distribution Notes

awesome-dsh-plugin reads 1–8 relative paths from the plugin repository root's `screenshots.json` and collects them in a nightly build; the screenshot order is controlled by that file. After updating the product repository screenshots, there is usually no need to submit another screenshot PR to awesome-dsh-plugin. The description YAML update and the screenshot update are two independent actions and should be accepted separately.