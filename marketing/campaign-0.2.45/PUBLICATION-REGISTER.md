# MCP Connector External Promotion Publication Register

Last updated: 2026-09-14 (Asia/Shanghai)

## Purpose

The user has confirmed that MCP Connector has published promotional content through multiple media channels, but the repository previously stored no canonical URLs, publication times, or source versions for those articles. Therefore we can currently confirm that the product repository, npm, GitHub Release, and major plugin catalogs have been updated; we cannot infer from this that every external media article body has also been synchronized.

This table is the single media registration entry point for future version updates. Without a real URL, keep the status as "pending registration"; never fabricate links or treat search result pages as article evidence.

## Canonical Sources

- Current version and install command: [npm](https://www.npmjs.com/package/dsh-mcp-connector), [latest Release](https://github.com/duhu2000/dsh-mcp-connector/releases/latest)
- Current product capabilities and screenshots: [README](../../README.md), [UI asset documentation](../../docs/screenshots/README.md)
- Dynamic connector count: [Registry statistics](https://github.com/duhu2000/dsh-mcp-connector-registry/blob/main/catalog-stats.json)
- External plugin catalog status: [Distribution master ledger](../../docs/DISTRIBUTION.md)
- Current campaign facts, metrics, and retrospective dates: [LEDGER.md](LEDGER.md)

## Known Media Registrations

| Channel | Canonical article URL | Publication time | Product version in article | Asset version | Current status | Next step |
|---|---|---|---|---|---|---|
| CSDN | Pending registration | Pending registration | To be verified | To be verified | User confirms it is published, repository has no URL | After adding the direct article link, verify the title, install command, counts, and screenshots |
| Sohu | Pending registration | Pending registration | To be verified | To be verified | User confirms it is published, repository has no URL | After adding the direct article link, verify the body text and outbound links |
| Tencent News | Pending registration | Pending registration | To be verified | To be verified | User confirms it is published, repository has no URL | After adding the direct article link, verify the version and product positioning |
| Zhihu | Pending registration | Pending registration | To be verified | To be verified | No repository evidence on whether it is published | If published, register the direct article link; if not, keep it as a candidate |
| Juejin | Pending registration | Pending registration | To be verified | To be verified | No repository evidence on whether it is published | If published, register the direct article link; if not, keep it as a candidate |

## Sync Checklist After Every Release or Patch

- [ ] The current version, npm install command, and Release link in the page match production.
- [ ] The exact connector count is read from `catalog-stats.json`; durable body copy should prefer writing "over a hundred" to avoid a version-independent static number going stale quickly.
- [ ] New features only reference already-released versions; drafts, PRs, or plans must not be written up as already shipped.
- [ ] Use the latest accepted assets; when continuing to use historical screenshots, the source version must be clearly labeled.
- [ ] Do not interpret npm download counts, GitHub clones, or market card counts as user counts.
- [ ] Do not claim default search rankings, that all connectors are free, that catalog inclusion equals a security audit, or that a visible cache means the service is currently callable.
- [ ] Retain the GitHub, npm, user manual, third-party connector contribution entry point, and issue reporting links.
- [ ] Record the modification date, the person making the change, the article URL, and the source version after modification.

## Current Conclusion

- The product repository, npm/GitHub metadata, the awesome-dsh-plugin description, and the current three tool workbench screenshots plus 43-second demo all have reviewable evidence.
- Whether the media article bodies are synchronized is still unknown; this is an operational evidence gap caused by missing canonical URLs, not a product development failure.
- Once direct article links are received, each article should be verified one by one and the table above updated; do not judge whether the body has been updated based only on search snippets.