# Screenshot asset notes

This directory holds the public UI screenshots of `dsh-mcp-connector`. Every asset comes from the credential-free UI harness: the outer browser viewport is 1280×720, and the harness reproduces the 800px product panel defined in `lib/client.js`, so the desktop layout is stably two cards per row. The images only show public catalog metadata, sample prompts and tool data explicitly marked as mock; they contain no OAuth token, API key, local path, user session or query result.

The assets are split into two groups so historical screenshots are not mistaken for the current version:

- `01`–`04` are historical Market, detail, discovery and import snapshots captured on 2026-09-06 from `v0.2.37`; at that time the public Registry had 105 entries, and after deduplicating against the 4 bundled unique cards it showed 109.
- `05`–`07` and `../demo.gif` are tool workbench, parameter and diagnostics assets captured on 2026-09-14 from the current `v0.2.46` UI harness. The catalog, connection and tool counts in the harness are test fixtures and do not represent production Market statistics.

Old assets opened the inner iframe directly at 1280px, bypassing the real 800px host panel, which triggered the 3-column `auto-fill/minmax(300px)` layout; that was an outdated capture harness/viewport, not product CSS drift. Every currently registered asset is captured directly from the real page state in the browser, with no post-hoc card reordering or connection state changes.

The repository-root [`screenshots.json`](../../screenshots.json) declares 7 images in the order: Market overview, connector detail, tool discovery, JSON import, unified tool search, parameter details and connection diagnostics. It is used by awesome-dsh-plugin and the DSH Market App Store-style detail page capture. The root manifest keeps a path array compatible with external consumers; [`assets.json`](assets.json) records the capture version, viewport, product panel, credential-free state, and the SHA-256, dimensions and GIF duration of each screenshot and of `demo.gif`.

| File | Content shown |
|---|---|
| `01-market-overview.jpg` | `v0.2.37` historical Market snapshot: 109 merged Market cards, two desktop columns, a featured section, 9 categories and the fixed category bar |
| `02-connector-detail.jpg` | `v0.2.37` intelligent document parsing detail: a single OAuth authorization connects both the remote URL parsing and the local `qcc-document-mcp` file parsing |
| `03-tool-discovery.jpg` | `v0.2.37` Context7 credential-free mock health status, mock tool counts/descriptions, search and a separate scroll area |
| `04-json-import.jpg` | `v0.2.37` Streamable HTTP / stdio JSON import and the local credential notice |
| `05-unified-tool-search.png` | `v0.2.46` unified tool search: cross-connection results, sources, discovery failure and the last successful cache |
| `06-tool-parameters.png` | `v0.2.46` parameter details: required, type, enums, nested structures and the raw safe schema |
| `07-connection-diagnostics.png` | `v0.2.46` connection diagnostics: successful cache, controllable failure causes, suggestions, "Check connection" and "Rediscover tools" |

`../demo.gif` is encoded from 6 real browser states in order: Market, connector detail, tool details, unified search, parameter schema, connection diagnostics. Its duration is 43 seconds at 960×540; the encoding only applies proportional scaling and GIF palette quantization and does not change layout or state.

`npm run storefront:check` validates paths, order, format, file existence, hashes, dimensions and capture constraints; `npm run check` already includes this gate. After updating the UI, keep capturing at a 1280×720 browser viewport with an 800px product panel and a credential-free initial state, and check the two-column desktop layout, that Qichacha cards do not show "Reauthorization required", and that the image contains no credentials, local paths, real sessions, query results or anything else that should not be public.

The "credential-free mock" badge at the top of the screenshots and the `mock_` prefix in tool names exist to clearly distinguish acceptance data from real authorization. A real user's installed count, authorization status and service health will differ depending on their local environment.