# External PR Draft

Suggested title:

> docs: update MCP Connector description for v0.2.45

Suggested body:

---

## Summary

Update only `data/plugins/duhu2000__dsh-mcp-connector.yml` so the English and Chinese descriptions reflect the features released in `dsh-mcp-connector@0.2.45`:

- cross-connection tool search;
- connection, server, and discovery-status filters;
- readable parameter details and the last successful cache time;
- per-connection diagnostics and tool rediscovery.

The Chinese description also uses the product spelling `MCP连接器`, while retaining natural references to MCP servers and connection management. URL, name, category, and install metadata are unchanged.

## Evidence

- Release: <https://github.com/duhu2000/dsh-mcp-connector/releases/tag/v0.2.45>
- Merged implementation: <https://github.com/duhu2000/dsh-mcp-connector/commit/82d240601df73b8e704124100ec5771a0cd5514a>
- Release notes: <https://github.com/duhu2000/dsh-mcp-connector/blob/82d240601df73b8e704124100ec5771a0cd5514a/CHANGELOG.md#L7-L23>
- Tool explorer UI: <https://github.com/duhu2000/dsh-mcp-connector/blob/82d240601df73b8e704124100ec5771a0cd5514a/ui/index.html#L1216-L1265>

The existing "over one hundred" claim is unchanged in substance and was previously reviewed in #4146. This PR adds no new numerical claim.

## Scope

- [x] Changes only this plugin's YAML entry.
- [x] Does not edit generated README files.
- [x] Does not add hand-written `npm` or `version` fields.
- [x] Does not claim that cached metadata means a remote tool is currently callable.
- [x] Does not claim a default ranking improvement.

Screenshots are maintained by the plugin repository's root `screenshots.json` and are not changed by this PR.

---

## Pre-Submission Notes

- This is a request description draft; it does not mean the PR has been submitted or that CI has run.
- After the user approves, the central session creates a branch from awesome-dsh-plugin's latest `main` and applies `awesome-dsh-plugin-description.patch`.
- If the maintainer asks to compress the copy, prioritize deleting the authentication protocol tail rather than deleting acceptance terms such as `MCP连接器`, `MCP Server`, `连接管理`, cross-connection tool lookup, and connection troubleshooting.
- Do not write the reason for the update as "improving default ranking"; write it as "completing natural search terms and syncing released capabilities".