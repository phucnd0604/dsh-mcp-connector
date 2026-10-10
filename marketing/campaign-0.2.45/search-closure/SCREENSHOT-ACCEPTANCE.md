# Promotional Asset Acceptance Specification

Date: 2026-09-13. Status: specification complete; the three new images and the new video are TODO, not yet generated.

## Verification of Existing Assets

The four current entries in screenshots.json: 01-market-overview.jpg, 02-connector-detail.jpg, 03-tool-discovery.jpg, 04-json-import.jpg (all located in docs/screenshots).
docs/screenshots/README.md and assets.json record: 2026-09-06, source 0.2.37, 1280×720 browser, 800px product panel; the 109 entries in the old images are a snapshot from that time and must not be retroactively changed to 110 to masquerade as a new capture. The old demo.gif is 960×540, 16 seconds, four-state encoded.
New assets must not simply open the internal iframe at 1280px and pass it off as an 800px host. The existing gate scripts/check-storefront-screenshots.mjs supports up to 8 images, but the format/order/metadata requirements should be re-verified by the integrator.

## Three-Image Design

| Candidate name | Page and state | Must be visible | Caption draft |
|---|---|---|---|
| 05-unified-tool-search.png | Tools page, more than two mock connections, a search term matching multiple sources | The keyword, connection/service filters, source, most recent status, cache time | Find tools across connections, narrow the scope by service (demo data) |
| 06-tool-parameters.png | Parameter details, one nested structure expanded | Name, type, required flag, enums, Raw Schema entry point | Understand parameter requirements and view the safe cached Schema as needed (demo data) |
| 07-connection-diagnostics.png | A controlled mock timeout that already has a successful cache | Mock failure indicator, diagnostics, cache time, Check connection/Rediscover tools buttons | View the last successful tool cache and troubleshoot the connection following the diagnostics (mock failure) |

The parameter image is not required to show the entire long Schema; it must not be shrunk to illegibility in order to fit everything in. The tools page is a list, not a marketplace card grid, so tool results are not required to be two columns.
The main visual may use a success state; a failure image must clearly mark it as a mock, and a failure must not be changed into a success in post-processing. Do not use a real invalid Token to create a promotional scenario.

## Capture and Redaction Acceptance Checklist

- [ ] 1280×720 browser, real 800px panel; text is legible, buttons are complete, and nothing is truncated or obscured.
- [ ] "Demo data / credential-less mock" is visible, the `mock_` identifier is retained, and the real user tool scale is not disguised.
- [ ] No OAuth Token, API Key, Header/env value, local path, email address, real session, or query result is included.
- [ ] Version, scope, cache time, and status do not contradict each other; the caption matches the capabilities shown.
- [ ] The original image is captured from real browser state, not produced with generative imagery or by rearranging the interface to fake product capabilities.
- [ ] Record the capture date, pinned commit, scenario, dimensions, and SHA-256; a new image joins the list only after passing visual inspection.
- [ ] The integrator syncs assets.json, screenshots.json, the asset README, the Chinese/English README links, and the storefront gate.
- [ ] `npm run storefront:check` and `npm run check` pass; check the release package size and legibility.

## Demo Pacing

0–6s platform/entry point; 6–18s cross-connection search and service filtering; 18–28s parameters; 28–40s mock failure cache and diagnostic actions; 40–45s install/contribution entry point.
Do not claim that real authorization is completed in 45 seconds, and do not demo paid or side-effecting tool invocations. Proportional re-encoding is allowed, but do not change state or hide the mock declaration.
The blocker is not insufficient product functionality: what is currently missing is only asset capture and real acceptance scheduling, and no further product development is needed.