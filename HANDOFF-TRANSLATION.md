# HANDOFF — English translation of dsh-mcp-connector (phucnd0604 fork)

**Status: COMPLETE.** The translation is finished and the full gate is green.
**Date of completion:** 2026-10-10
**Repo:** `C:\Users\phucn\Documents\Default Project\dsh-mcp-connector`
**Fork:** `phucnd0604/dsh-mcp-connector` (remote name `phucn`)
**Upstream (do not push):** `duhu2000/dsh-mcp-connector` (remote name `origin`)

---

## 1. What this fork is

An **English-primary translation fork**. Upstream shipped Chinese `README.md` + `README.en.md`;
this fork makes `README.md` English and deletes `README.en.md`. Distribution metadata was
updated so no Chinese reaches the published artifact.

---

## 2. Final state

| Check | Result |
|---|---|
| `npm run check` | **exit 0** |
| `npm test` | **333 tests, 330 pass, 0 fail** |
| Chinese lines left in `lib/` | **3, all intentional** (see §4) |

### The 3 intentionally-Chinese lines in `lib/`
| File:line | Content | Why it stays |
|---|---|---|
| `lib/schema.js:306` | `category: c.category ?? '其他',` | Catalog **data key**. Must keep matching the upstream catalog keys that `ui/index.html` maps literally. |
| `lib/mcp-http.js:78` | auth-error **regex** with `未授权|无权|密钥|令牌` | Matches Chinese error text returned by upstream services. Removing these changes behavior. |
| `lib/mcp-validation.js:170` | same regex | same reason |

Also intentionally Chinese: `vendor` values (企查查, 北大法宝, Wind 万得 …), `category` values in
`catalog/` + `registry/`, the `default`/`placeholder` examples in `registry/connectors/*.json`
(real Chinese legal terms, not UI copy), the `CATEGORY_MAP` `value:` fields and the
Chinese-matching regexes in `ui/index.html`, and Chinese **test fixture data** in `test/`.

---

## 3. Git state

| Remote | Branch | Note |
|---|---|---|
| `phucn` | `main` | **push here** — always with an explicit remote: `git push phucn main` |
| `origin` | `main` | **never push** — it is upstream |

A bare `git push` would overwrite upstream. Local git identity is
`phucnd0604 <phucnd0604@gmail.com>`.

---

## 4. What changed in the final pass

- **All remaining `lib/*.js` Chinese translated** — 28 files: `tools.js`, `client.js`,
  `cli-providers.js`, `index.js`, `schema.js`, `governance.js`, `mcp-http.js`,
  `mcp-validation.js`, `oauth.js`, `util.js`, `web.js`, `catalog.js`, `probe.js`,
  `prompts.js`, `migration.js`, `connection-backup.js`, `connection-editor.js`,
  `connection-scopes.js`, `callback-server.js`, `version-status.js`,
  `tool-catalog-cache.js`, `constants.js`, `diagnostics.js`, `stores.js`, `status-events.js`,
  `grant-journal.js`, `grant-lifecycle.js`, `mcp-provision.js`, and `lib/connectors/*.js`.
- **Catalog `clientName` translated** in `catalog/catalog.json`, `catalog/catalog.sample.json`
  and `registry/catalog.json` → `DeepSeek Harness - MCP Connector`. This string appears on the
  OAuth consent screen, so leaving it Chinese would have shipped visible Chinese. Note that these
  files **override** the `lib/schema.js` default, so translating only the default was not enough.
- **15 test files updated** to assert the new English strings. Every assertion was kept equally
  strict — alternations were preserved, no test was deleted, skipped or weakened.
- **Dev scaffolding deleted**: `scripts/apply-i18n.mjs`, `scripts/i18n-lines.mjs`, all
  `.i18n-*.json` mapping files, and all scan/output scratch files.

---

## 5. Regression test that must not be removed

`test/ui.test.mjs` compiles the inline `<script>` block in `ui/index.html`, so a parse failure can
never ship again:

```js
import { compileFunction } from 'node:vm';
test('the inline UI script parses as valid JavaScript', () => {
  const blocks = [...uiSource.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(blocks.length > 0, '...');
  for (const [, source] of blocks) {
    assert.doesNotThrow(() => compileFunction(source, [], { filename: 'ui/index.html' }), ...);
  }
});
```

Commit `206484e` shipped a **broken panel** that no test caught: an unescaped apostrophe inside a
single-quoted JS string made the whole inline script fail to parse. **When adding English copy
containing an apostrophe, reword it or escape it.**

---

## 6. Verification commands

```bash
npm run check      # lint + docs + marketing + storefront + test + verify-pack
```

Fast targeted loops:
```bash
node --test test/tools.test.mjs test/diagnostics.test.mjs
node --check lib/tools.js
# inline UI guard:
node -e "const fs=require('fs');const h=fs.readFileSync('ui/index.html','utf8');const js=h.match(/<script>([\s\S]*?)<\/script>/)[1];fs.writeFileSync('/tmp/ui.js',js);" && node --check /tmp/ui.js
```

**PowerShell caveat:** never pipe UTF-8 file output straight to the console — it mangles Chinese into
mojibake. Write to a file with `Out-File -Encoding utf8` and read that file with the read tool.

---

## 7. Runtime verification method (Playwright)

DSH runs at `http://127.0.0.1:19387`; the plugin panel is at
`http://127.0.0.1:19387/mcp-connector/ui/`.

Playwright `browser_take_screenshot` with an explicit `filename` writes outside the workspace —
omit `filename` to get the image returned inline.

---

## 8. Remaining optional work (not blocking)

1. `docs/` still contains Chinese design documents and `CHANGELOG.md` is Chinese. These are
   historical/developer docs, not shipped UI, and `npm run check` does not guard them.
   Translating them is a separate, larger pass.
2. Pull upstream `origin` periodically and re-translate any new commits.
