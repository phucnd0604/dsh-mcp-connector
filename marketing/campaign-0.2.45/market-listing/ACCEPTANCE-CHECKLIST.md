# Post-Publish Search and Ranking Acceptance

## Acceptance Prerequisites

- [ ] The user has explicitly approved external submission.
- [ ] The description PR is merged and awesome-dsh-plugin has completed its site rebuild.
- [ ] Both the Chinese and English target entries show the new copy.
- [ ] The browser uses a page with no login and no leftover filter effects; the category is "All", and "Installable from npm" and "Added in the last 7 days" are both off.
- [ ] The sort dropdown remains at the default "Downloads".

## Current Baseline (Before Submission)

Verification time: `2026-09-12T21:56:47+08:00`.

| Query | Page | Current matches | Target position | Current status |
|---|---|---:|---:|---|
| `mcp` | Chinese | 171 | 2 | Pass |
| `MCP连接器` | Chinese | 0 | — | Fail; the existing copy only has the spaced form |
| `连接器` | Chinese | 5 | 1 | Pass |
| `mcp server` | Chinese | 17 | 1 | Pass |
| `连接管理` | Chinese | 1 | 1 | Pass |
| Cleared query | Chinese | 3,561 | 62 | Recorded; no rank target set |

Supplemental: on the English page `mcp` is 2nd of 174 and `mcp server` is 1st of 67.

## Post-Publish Execution Steps

Execute each query separately, and do not reuse old result counts:

1. Open the Chinese homepage `https://awesome-dsh-plugin.com/zh/`.
2. Confirm the category "All", the default sort "Downloads", and that both additional filters are off.
3. Enter the query and wait for the page count to stabilize.
4. Confirm the `duhu2000/dsh-mcp-connector` card is visible and record "target position / total matches".
5. Open the target detail page and confirm the Chinese and English descriptions match the approved copy.
6. Clear the query and record the default position, downloads in the last 30 days, Stars, the version shown in the marketplace, and the total catalog count.

Recommended shareable URLs:

- <https://awesome-dsh-plugin.com/zh/?q=mcp>
- <https://awesome-dsh-plugin.com/zh/?q=MCP%E8%BF%9E%E6%8E%A5%E5%99%A8>
- <https://awesome-dsh-plugin.com/zh/?q=%E8%BF%9E%E6%8E%A5%E5%99%A8>
- <https://awesome-dsh-plugin.com/zh/?q=mcp+server>
- <https://awesome-dsh-plugin.com/zh/?q=%E8%BF%9E%E6%8E%A5%E7%AE%A1%E7%90%86>

## Post-Publish Record Table

| Query | Acceptance time | Total catalog entries | Matches | Target position | Card visible | Copy correct | Notes |
|---|---|---:|---:|---:|---|---|---|
| `mcp` | TODO | TODO | TODO | TODO | TODO | TODO | |
| `MCP连接器` | TODO | TODO | TODO | TODO | TODO | TODO | |
| `连接器` | TODO | TODO | TODO | TODO | TODO | TODO | |
| `mcp server` | TODO | TODO | TODO | TODO | TODO | TODO | |
| `连接管理` | TODO | TODO | TODO | TODO | TODO | TODO | |
| Cleared query (default) | TODO | TODO | Total catalog entries | TODO | TODO | TODO | Recorded only |

## Pass Criteria

- All five query groups show the target card; among them, `MCP连接器` going from the current 0 matches to visible is the main search acceptance point of this copy update.
- The target card's name, repository link, category, install command, and Chinese/English descriptions are all correct.
- The default sort remains "Downloads"; just record the position at the time, and do not use a position above 62 or any absolute rank as a pass condition.
- The target version eventually syncs to `0.2.45`. If the description is updated but the version is still `0.2.44`, mark it "auto-detection pending sync", do not misjudge it as a description PR failure, and do not add an invalid `version` field to the YAML.
- If the product repository screenshots have been updated, the marketplace detail page should display the `v0.2.45` assets in the new order; a screenshot sync failure and a description search failure are recorded separately.

## Ranking Explanation Template

> This copy update completes natural search terms such as `MCP连接器` and makes the marketplace introduction reflect the capabilities released in 0.2.45. awesome-dsh-plugin's search is a literal substring filter, and the default order is determined by npm downloads in the last 30 days and, on ties, by Stars; therefore only the actually visible position is reported here, with no promise of or attribution for a default ranking improvement.