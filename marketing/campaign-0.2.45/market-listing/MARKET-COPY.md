# 0.2.45 Market Copy and Keywords

## Usage Principles

- Write the product name uniformly as `MCP Connector`; if the marketplace has a separate keyword field, additionally add `MCP connector` as a space variant.
- awesome-dsh-plugin has no published description character limit, but requires a single line ending with a period, states only facts verifiable from code, and uses no superlatives or marketing terms.
- Its detail page HTML meta description is truncated at roughly 155 characters, so the core positioning and tool lookup capability should go at the front.
- "Over one hundred" carries forward the conservative wording already approved in #4146 and re-verified against the 0.2.45 data evidence; the volatile precise counts of 106/110 are not written into short marketplace copy.
- Adding keywords in copy can only change "whether it matches"; default sorting is determined by downloads and Stars, so no improvement can be promised.

## A. awesome-dsh-plugin Full Description (Recommended)

English, 437 characters:

> MCP Connector for DeepSeek Harness with a directory of over one hundred connectors. Connect to MCP servers, search tools across connections, manage and troubleshoot connections, filter by connection/server/status, inspect readable parameters and the last successful cache time, and use per-connection diagnostics and tool rediscovery; supports OAuth 2.0 PKCE, API keys, stdio/HTTP, and mcpServers JSON import. Maintained by Qichacha/QCC.

Chinese, 194 characters:

> MCP连接器：在 DeepSeek Harness 中通过持续更新的超百个连接器目录接入 MCP Server、跨连接查找工具，并完成连接管理与连接排障；可按连接/服务/发现状态筛选，查看易读参数、最后成功缓存时间和诊断，并逐连接重新发现工具；支持 OAuth 2.0 PKCE、API Key、stdio/HTTP 和 mcpServers JSON 导入；由企查查/QCC 团队维护。

This copy set covers the five acceptance queries and places 0.2.45's core new capabilities before the authentication protocol. It does not claim that it executes the target tool, works offline, is entirely free, or improves default ranking.

## B. General Short Description (With Catalog Size)

Suitable for short description fields or campaign cards; before use, confirm that the marketplace allows the factual expression `100+ / over one hundred`.

English, 117 characters:

> 100+ MCP connectors, one place to connect MCP servers, search tools across connections, and troubleshoot connections.

Chinese, 45 characters:

> 超百个 MCP连接器，一个入口完成 MCP Server 接入、跨连接工具查找与连接排障。

## C. General Durable Short Description (Without Counts)

Suitable for marketplaces that have no auditable count source or whose sync cycle is unknown.

English, 132 characters:

> MCP Connector for DeepSeek Harness: connect to MCP servers, search tools across connections, and manage or troubleshoot connections.

Chinese, 62 characters:

> MCP连接器：在 DeepSeek Harness 中接入 MCP Server、跨连接查找工具，并完成连接管理与连接排障。

## Keyword Suggestions

Ordered by natural search intent; mechanically repeating them in the body is not recommended:

1. `MCP Connector`
2. `MCP Connector` (product name, space-free variant for Chinese queries)
3. `MCP Server`
4. `connector`
5. `connection management`
6. `tool lookup`
7. `connection troubleshooting`
8. `tool search`
9. `tool discovery`
10. `tool rediscovery`
11. `OAuth 2.0 PKCE`
12. `API Key`
13. `stdio`
14. `HTTP`
15. `mcpServers JSON`

awesome-dsh-plugin has no separate keyword field; what is actually searched is the card's visible text, and the full description naturally covers the first five acceptance terms. If other marketplaces support tags/keywords, fill them in in the order above, limited to the number they allow, and do not add words the product does not have.

## Expressions to Avoid

- Do not write "best, most complete, leading, official, the only, one-stop" and similar words that cannot be objectively verified or are easily read as marketing.
- Do not write "default ranking rises after the copy is updated"; the default position depends on npm downloads in the last 30 days and, in the event of a tie, on Stars.
- Do not write the 106 Registry entries, 110 deduplicated cards, or npm download counts as user counts, customer counts, or installer counts.
- Do not write "usable offline after caching" or "still callable during an outage"; you may only write "the last successful cache time can be viewed", because a viewable cache does not mean the service is currently callable.
- Do not write "entirely free" or "no authorization required"; different connectors may require OAuth, an API Key, a subscription, network access, or a local runtime environment.
- Do not submit this product to a catalog that only accepts MCP Servers and claim that it is an MCP Server; it is a DeepSeek Harness plugin, an MCP client/connection manager, and a connector directory.