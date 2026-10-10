# MCP Connector 0.2.45 Market Listing Optimization Delivery

Status: the drafts have been integrated and shipped; the three new screenshots and 43-second demo are complete, and the current search re-verification is below.

Fixed baseline:

- Product version: `dsh-mcp-connector@0.2.45`
- Merge commit: `82d240601df73b8e704124100ec5771a0cd5514a`
- Verification time: `2026-09-12T21:56:47+08:00`
- Target marketplace: [awesome-dsh-plugin](https://awesome-dsh-plugin.com/)
- This round generates evidence and drafts only; it does not modify the public README, `package.json`, `marketing/metadata.json`, or `screenshots.json`, and does not submit an external PR.

The above is the fixed baseline as of task start. Subsequent modification of public files and external state was completed centrally by the master ledger session: Connector [PR #74](https://github.com/duhu2000/dsh-mcp-connector/pull/74) and release [PR #75](https://github.com/duhu2000/dsh-mcp-connector/pull/75) were merged and released as `0.2.46`; awesome-dsh-plugin [PR #4982](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/4982) was merged and the public entry synced to `0.2.46`.

## 2026-09-14 Post-Launch Re-verification

The actual local DSH Web using `dshmarket@1.46.1`, discovery page "All" category, approximately 3.6k entries:

| Query | Rank | Status |
|---|---:|---|
| `mcp` | 1 | Pass |
| `mcp连接器` | 1 | Pass |
| `连接器` | 1 | Pass |
| `连接管理` | 1 | Pass |
| `mcp server` | 15 | Dropped from 5th place in the `1.38.1` baseline; needs to be a follow-up English relevance optimization item |

The new assets have been added to the product repository's `screenshots.json`: `05-unified-tool-search.png`, `06-tool-parameters.png`, `07-connection-diagnostics.png`; the 43-second `docs/demo.gif` was updated in sync. External marketplaces consume these files on their own crawl cycle, so no duplicate screenshot PR is created for the same coordinates.

## Conclusion

1. The plugin is already cataloged. The initial cataloging PR #2633, the introduction optimization PR #3656, and the count wording PRs #4119 and #4146 have all been merged; the target YAML has had no new commits since #4146.
2. The live catalog had 3,561 entries at the time of this verification, and the target entry was ranked 62nd under the default "npm downloads in the last 30 days" sort. Copy does not participate in default sorting, so this update cannot promise an improvement in default rank.
3. Current search performance on the Chinese page: `mcp` 2nd of 171, `连接器` 1st of 5, `mcp server` 1st of 17, `连接管理` 1st of 1; `MCP连接器` (without a space) returns 0 results. The recommended copy standardizes the product name as the space-free `MCP连接器`, closing the only clear keyword gap.
4. The current marketplace copy does not cover 0.2.45's unified tool search, connection/service/discovery status filtering, readable parameters, last successful cache time, per-connection diagnostics, or tool rediscovery. It is recommended to submit one update PR that "modifies only our own YAML description".
5. The 4 current marketplace screenshots are still labeled `v0.2.37` and do not show 0.2.45's separate "Tools" page, filtering, parameter details, or connection troubleshooting. The screenshots should first be updated in the product repository; awesome-dsh-plugin collects them automatically each night from this repository's `screenshots.json`, so the external catalog does not need a separate screenshot modification.
6. The live catalog API still shows version `0.2.44`, while npm `latest` is already `0.2.45`. The version field is auto-detected by the marketplace, and the YAML has no manually fillable version field; simply re-verify after the next detection round.

## Delivered Files

- [EVIDENCE.md](EVIDENCE.md): live entry, PR history, ranking mechanism, current search baseline, and version sync gap.
- [MARKET-COPY.md](MARKET-COPY.md): long and short copy in both languages, keyword ordering, and prohibited expressions.
- [SCREENSHOT-ORDER.md](SCREENSHOT-ORDER.md): 0.2.45 screenshot gaps, recommended order, and asset acceptance rules.
- [ACCEPTANCE-CHECKLIST.md](ACCEPTANCE-CHECKLIST.md): five-group search and default sort re-verification table after publishing.
- [awesome-dsh-plugin-description.patch](awesome-dsh-plugin-description.patch): external PR patch draft that changes only the target YAML.
- [PR-BODY.md](PR-BODY.md): external PR title and description draft.

## Originally Recommended Execution Order and Results

1. Done: the search closure task delivered and accepted three new screenshots.
2. Done: the master ledger session updated the product repository's `screenshots.json`, asset hashes, and the bilingual README.
3. Done: the central session submitted and merged awesome-dsh-plugin description PR #4982.
4. Done: five groups of queries were re-verified after the marketplace rebuild; the default rank is only recorded, with no promise of improvement through copy.
5. Done: the public entry version is synced to `0.2.46`; subsequent version drift is deduplicated and tracked by the distribution sync check and Issue #69.