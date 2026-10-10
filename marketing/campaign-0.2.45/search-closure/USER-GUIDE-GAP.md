# User Guidance Gap

Date: 2026-09-13. Based on the verified content of 0.2.45; suggestions only, and no public files were modified.

| Location | Existing content | Gap and handling |
|---|---|---|
| README.md opening introduction | Over one hundred, authorization, protocol support | The hero benefit is insufficient; the unified promotion source owner provides the final Chinese/English descriptions, to avoid finalizing a copy twice in this task |
| README.md "Tool discovery and troubleshooting" | A brief description of the new tools page and backoff | Add clear steps and a manual link; change the five-minute wording to "becomes due" and note that it depends on the page connection |
| README.md corresponding English section | English feature overview | Sync the scope, cache, and parameter redaction boundaries with the Chinese version |
| Both READMEs "Usage" | Marketplace, connection, management | Add a tools page entry point; distinguish catalog search from connected-tool search |
| docs/USER-GUIDE.md section 5 | Single connection details, Prompts, tool cache, and conversation search | Missing a standalone tool workspace tutorial; insert 5.1 through 5.4 before section 6, without renumbering the rest |
| README "Interface and demo" | Four old assets | The current asset notes are marked 0.2.37 and cannot be called 0.2.45 tools page screenshots; keep the old images with accurate labeling until the new assets pass acceptance |
| README comparison table | Capabilities of an ordinary configuration panel, described generically | Recommended to change to a list of its own capabilities, to avoid unverified sweeping generalizations about competitors |

## Integration Boundaries

The suggested text is in README-PATCH.md. The integrator should first verify the latest state of the public files, then merge by heading anchor; do not force an overwrite using old line numbers. marketing/metadata.json, the marketplace YAML, and the package description should be updated once, coordinated by the unified copy owner.
The new screenshots have not been captured yet, so do not add dead image links, do not change screenshots.json, and do not replace old hashes.
This task does not modify running code and does not republish to npm; whether to release the documentation patch is decided by the central session.