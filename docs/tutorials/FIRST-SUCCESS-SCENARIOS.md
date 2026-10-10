# Three First-Success Scenario Packs

These three packs turn the [unified first-success path](README.md) into reviewable tasks. They are acceptance steps, not proof of promotion that "every account has succeeded". Pick only one provider-permitted read-only task at a time; when the account, organization, plan, administrator approval or redacted sample is unavailable, keep "no evidence / pending user acceptance". Status records follow the [trusted status copy guidelines](TRUSTED-STATUS-COPY.md).

## Scenario 1: Read-only company information lookup

**Goal**: use "Qichacha · Company Registration" (`qcc-company`) to look up the basic registration information of one public, non-sensitive test entity, and verify the entity name and the update/data date in the result (if the service returns them).

| Item | Acceptance requirement |
|---|---|
| Prerequisites | A release `dsh-mcp-connector@0.2.59+`; the current Workspace; working Qichacha OAuth; a test account with permission for the target company data |
| Permissions / administrator | Account permissions, organization authorization and visible fields are controlled by the service provider; an enterprise organization may need administrator provisioning, and this document cannot replace approval |
| Cost | May be affected by plan, call count or field permissions; the MCP Connector cannot confirm this run's cost, so verify on the provider's side before invoking |
| Runtime / data destination | Remote MCP Server; the company name, query parameters and invocation results are sent to / returned from `agent.qcc.com` through the DSH Host |
| Safe input | Use a public test entity name; do not use customer lists, internal labels or undisclosed investigation targets for public acceptance |
| Expected output | Recognizable basic entity information; fields, page counts and data date follow what the real tool returns — do not assume a certain field is present |

Acceptance steps:

1. Connect "Qichacha · Company Registration" in the Market, and record the scope, enable/disable state, authorization status and check time in "Installed".
2. Search for "company registration / basic company information" in "Tools" and verify the source is `qcc-company`; record the actual tool name and required parameters, and do not guess the tool name from a prompt title.
3. Send this in a normal DSH session:

   ```text
   Please use only the Qichacha company registration read-only tool you just confirmed, and look up the basic registration information of "<public test company name>".
   Before invoking, list the tool source, the actual tool name, the key parameters, and whether account permissions and cost still need confirmation on the provider's side.
   Do not expand to related persons, risk scans or bulk lists; if extra permissions, payment or write operations are needed, stop.
   ```

4. After Host approval, verify the result entity matches the input; keep only a redacted field list, the invocation time and the success/failure conclusion, and do not upload full business results.

Failure recovery: when the entity is ambiguous, add an identifier field the provider allows; for 403/missing fields, first check the account plan and organization permissions; if the tool does not appear, follow the [tool discovery recovery tutorial](TOOL-SEARCH-RECOVERY.md); for OAuth failures, follow the [authorization diagnostics](OAUTH-DIAGNOSTICS.md). Never repeatedly request data you are not authorized to access.

**Verification status (2026-09-29)**: the release pack, catalog description, remote server configuration and tutorial paths have been verified; no real business invocation was executed with an authorized account in this round, so the invocation layer is **no evidence / pending user acceptance**.

## Scenario 2: Local intelligent document parsing

**Goal**: use the local entry point `qcc-document-mcp` of "Qichacha · Intelligent Document Parsing" (`qcc-document`) to parse a purpose-made test PDF/image containing no personal or customer data, and return Markdown or a structured summary.

| Item | Acceptance requirement |
|---|---|
| Prerequisites | Node.js 20+; a trusted npm network; Qichacha OAuth; the ability to run `npx -y qcc-document-mcp` locally; a redacted test file ready |
| Permissions / administrator | The OAuth account needs document parsing permission; an enterprise environment may restrict local processes, npm downloads or file uploads and require administrator approval |
| Cost | Parsing counts, page counts, OCR or structured output may be limited by plan/quota; verify on the provider's side before invoking |
| Runtime / data destination | **Local process + remote processing**: the local Agent reads the specified file and automatically uploads it to the Qichacha service for processing; a "local entry point" does not mean the file is processed only on the device |
| Safe input | Use only synthetic/public test documents; never upload original contracts, ID cards, customer materials, keys or restricted files |
| Expected output | Markdown, body text/tables or key fields; follow the actual tool schema and return value, and do not assume every layout is fully recoverable |

Acceptance steps:

1. Connect "Qichacha · Intelligent Document Parsing", and confirm that both the remote `qcc-document` and the local `qcc-document-mcp` have completed discovery/Host registration; if only one entry point appears, do not record the dual-entry check as passed.
2. Find the local file parsing tool in "Tools" and review its actual parameters; confirm the file path points to the dedicated test file.
3. Send this in a normal DSH session:

   ```text
   Please use only the confirmed qcc-document-mcp local file read-only parsing tool to process "<redacted test file path>".
   Before invoking, explain that the file will be read by the local Agent and uploaded to the Qichacha remote service, list the path/file type that will be sent, and state whether cost or quota is unknown.
   Return only Markdown and key fields; if the file contains personal information, customer data or keys, or if extra payment/permission is needed, stop.
   ```

4. After Host approval, verify the output is recognizable and contains no data you did not supply; the acceptance record keeps only the test file hash/type, tool name, time and conclusion, and does not keep real local paths or full body text.

Failure recovery: if the local process does not start, check Node/npm, the proxy, the command and the Host logs; if only the remote entry point succeeds, do not claim local parsing succeeded; for upload/authorization failures, investigate using the stable stage/code; if the format is unsupported, switch to a synthetic sample the provider explicitly supports instead of uploading real material to test.

**Verification status (2026-09-29)**: the release catalog has been verified for dual entry points, OAuth resources and the local `npx` configuration; this round had no user-authorized account and no approved test file, so the real upload and invocation layers are **no evidence / pending user acceptance**.

## Scenario 3: Authorized office document or schedule lookup

**Goal**: choose one of the office service connections the current user is already authorized for, and read the title/update time of one dedicated test document, or the times/titles of the next three events in a test calendar. Verify reading only — do not create, modify, comment, invite or delete anything.

| Item | Acceptance requirement |
|---|---|
| Prerequisites | An installed and enabled MCP/controlled CLI Provider that explicitly supports office document or calendar reads; an isolated test workspace/calendar with test data |
| Permissions / administrator | The OAuth scope/CLI login must cover the target resource; the organization may disable third-party apps, require administrator approval, or allow only specific workspaces |
| Cost | The provider's plan, API quota, advanced search or cross-source capabilities may be chargeable; the connector never interprets "authorized" as "free" |
| Runtime / data destination | With a remote MCP server, parameters/results are sent to the office service; with a controlled local CLI, the command runs locally but still calls the office service API; results then enter the DSH/model context |
| Safe input | Use only dedicated test documents/calendars; do not read real meeting topics, attendees, customer files or sensitive organization content for public acceptance |
| Expected output | The document title and update time, or at most three test event titles and times; body text, attendees and attachments are not returned unless the test scope explicitly allows it |

Acceptance steps:

1. In "Installed", confirm the connection name, the project/global scope, the authorization status and any administrator prerequisites; when the account/organization is not visible, record "the current connection cannot confirm this".
2. Search for "document read/search" or "calendar query" in "Tools" and verify the service source, the read-only semantics, the actual parameters and the tool name; if you only see write tools, stop.
3. Send this in a normal DSH session, depending on the branch you chose:

   ```text
   Please use only the office service read-only tool you just confirmed, and complete one of the following two tasks within the authorized test scope:
   A. Find the document titled "<test document title>" and return only the title and update time; or
   B. Query the test calendar for the next three events and return only titles and start/end times.
   Before invoking, list the service source, the tool name, the authorization scope, the administrator prerequisites, the data destination and any possible cost.
   Do not read body text/attachments/attendees, and do not create, modify, comment, invite or delete; stop if the scope is unclear.
   ```

4. After Host approval, compare only the test data against the expected answers; record a redacted result summary, the tool name, the time and the test tenant used, and do not record real account or organization names.

Failure recovery: when authorized but the tool is missing, first confirm the scope/administrator policy and Host registration; do not bypass a 403 by logging in repeatedly; for rate limiting, wait according to Retry-After/the diagnostic; without an isolated test tenant, keep the result pending acceptance and do not substitute an individual production account.

**Verification status (2026-09-29)**: the unified connection, discovery and Host approval paths have been verified; no authorized office test workspace/calendar and no administrator approval evidence were provided, so both the connector selection and the real invocation are **no evidence / pending user acceptance**.

## Unified acceptance record

For each scenario, record only these redacted fields: plugin version, DSH Host/Market version, connector and server, project/global scope, whether the account/organization can be confirmed, the conclusions for the authorization/discovery/invocation layers, permissions/administrator prerequisites, runtime location, data destination, cost basis, the actual tool name, the check time with timezone, the failure stage/code and the recovery action. Do not record tokens, cookies, authorization codes, full business inputs/outputs, local absolute paths or real organization identities.