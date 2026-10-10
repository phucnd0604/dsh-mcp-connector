# Trusted Status Copy Guidelines

These guidelines apply to the MCP Connector pages, tutorials, acceptance records and issue reports. The goal is not to make status sound more optimistic; it is to let users tell apart a service provider's claim, a plugin observation, a Host observation, and real invocation evidence. Without evidence, show "unknown / pending acceptance" — a saved connection, a tool cache, download counts or demo screenshots are not substitutes.

## What a status must answer

Present these in the order below; when a field is unavailable keep "unknown" rather than hiding the whole item:

| Dimension | Acceptable copy | Evidence requirement |
|---|---|---|
| Account / organization | `Account: confirmed (redacted)`, `Organization: confirmed (redacted)`, `Account/organization: the current connection cannot confirm this` | Only use a redacted identity that the service provider or Host explicitly returned and permits displaying; never guess from a token, an email fragment or a connection name |
| Authorization | `Authorized`, `Reauthorization required`, `Auto-retrying`, `Authorization status unknown` | The current observation from an OAuth/credential check; a successful authorization callback does not mean the tool is registered |
| Discovery / registration | `Discovery succeeded`, `Discovery failed (still showing the last successful cache)`, `Not discovered yet`, `Host registration status unknown` | The most recent `tools/list`/Host registration observation and its time; a cache only proves that discovery succeeded in the past |
| Invocation | `Read-only invocation accepted`, `Invocation failed`, `Invocation: no evidence / pending acceptance` | Concrete evidence of a specific invocation, approved through the Host in a normal DSH session; the MCP Connector should not infer or add covert invocation telemetry |
| Permissions / administrator prerequisites | `The current account needs ... permission`, `Organization administrator approval may be required`, `Administrator prerequisites: pending service provider confirmation` | A public provider statement or a real tenant response; do not extrapolate an individual account's success to an enterprise organization |
| Runtime location | `Remote MCP Server`, `Local stdio process`, `Local process + remote processing` | From the connection configuration; "local process" does not automatically mean "data never leaves the machine" |
| Data destination | `Parameters are sent to <provider/domain>`, `Local files are read by the local Agent and then uploaded to <provider>`, `Data destination: pending service provider confirmation` | Configuration plus provider documentation; never write only "local" and omit the subsequent upload or remote processing |
| Cost | `May incur charges; the provider's plan/quota governs`, `This run's cost: the plugin cannot confirm it`, `Public documentation states it is free (with source and date)` | Only an explicit, dated provider basis may be called free; no-password does not mean free |
| Time / evidence | `Checked at: YYYY-MM-DD HH:mm:ss ±HH:mm`, `Evidence: plugin observation / Host observation / manual read-only acceptance` | Times must include a timezone; show the last success time and the current check time separately |

## Layered status template

```text
Connection: <saved / not saved / status unknown>; Scope: <project / global / unknown>
Account / organization: <redacted confirmed value / the current connection cannot confirm this>
Authorization: <authorized / reauthorization required / auto-retrying / unknown>
Discovery / registration: <succeeded / failed, showing the last successful cache / not discovered yet / Host status unknown>
Invocation: <read-only invocation accepted / invocation failed / no evidence, pending acceptance>
Permissions / administrator prerequisites: <known requirement / pending provider confirmation>
Runtime and data destination: <remote / local stdio / read locally then uploaded to remote>
Cost: <known basis / the plugin cannot confirm it>
Checked at: <time with timezone>; Evidence: <plugin / Host / manual acceptance>
```

"Overall working" may be used only when the configuration, discovery/registration and invocation layers all have current evidence, and it must be limited to this specific account, organization, tool and verification time. When only some servers succeed, write "partially degraded"; you must not describe the connector as a whole as "connected and working".

## Fixed wording for status changes

- Configuration saved but nothing discovered yet: `Connection saved; there is still no tool discovery/Host registration evidence, so it cannot yet be judged callable.`
- Most recent discovery failed but a cache exists: `Most recent discovery failed; showing the last successful cache from <time>. The cache does not mean the service is callable right now.`
- A temporary OAuth refresh failure: `Authorization refresh failed temporarily and is retrying with backoff; there is no evidence of permanent failure, so there is no need to reauthorize immediately.`
- An explicit permanent authorization failure: `The service provider rejected the request or the grant has expired, so reauthorization is required; the existing tool cache is not evidence of current authorization.`
- A real invocation has not been completed: `Configuration and tool discovery have passed; the real read-only invocation has no evidence and is pending acceptance.`
- Account, organization or cost information is missing: `The current connection cannot confirm the account/organization/this run's cost; please verify on the service provider's side.`

## Schema change warnings

A schema comparison must state what is being compared; it cannot just show "updated". The candidate minimal implementation in draft PR #105 only compares **the two safely truncated discovery caches before and after the same connection signature**; until that PR has completed real Host UI acceptance, been merged and shipped in an official release, this section is a design and acceptance baseline only, and must not be advertised as a shipped capability. Even once implemented, it does not prove that the current Host enforces the same schema, and it will never automatically trigger or pass approval. When only the catalog declares something, write "catalog declaration"; never pass it off as a runtime result.

The draft PR #105 candidate page copy is below; it must not be written as "the current page already shows" until it is merged and released:

- `The cached parameter structure has changed and may affect existing invocations; verify the parameters before use, and re-confirm as the Host requires.`
- `Schema is incomplete or has no history, so compatibility cannot be determined.`
- `Discovery cache only; invocation: no evidence / pending acceptance.`

The current discovery check time and the last successful cache time should be displayed in adjacent fields separately, and not folded into the fixed sentences above. The finer classification below is a follow-up design baseline; without a shipped implementation and real Host UI acceptance evidence, you must not claim that schema change warnings, complete breaking-change determination or approval binding are done.

| Status | Recommended copy | Follow-up action |
|---|---|---|
| No historical baseline | `Schema: first observation, no comparable baseline yet.` | Review current required fields, types and constraints before approving an invocation |
| No change detected | `Schema: no change detected compared with the last successful cache from <time>.` | Still execute under current Host approval; this does not mean the service's business semantics never change |
| Only new optional items | `Schema: new optional parameters/tools detected; no breaking change to existing required parameters detected.` | Show the differences; new tools or parameters do not automatically widen allow rules or authorization |
| Possibly breaking compatibility | `Schema change: tool removal, newly required parameters, narrowed types/enums or other incompatible differences detected; review the parameters and confirm approval before invoking.` | Pause automatic reuse of old parameters; have the Host/user re-confirm, and do not automatically retry writes or paid invocations |
| Current schema unavailable | `The current schema cannot be confirmed; showing the last successful safe cache from <time>, which cannot be used to judge current callability.` | Check the connection / re-discover; keep it unknown and do not mark the cache green |
| Side effects unclear | `Tool side effects: the service did not provide them, or the Host did not pass a reliable marker; read-only behaviour cannot be concluded from this.` | Confirm manually against the tool description and provider documentation; never guess from the name |

Determining "possibly breaking compatibility" covers at least: a tool removed/renamed, an optional field becoming required, an input type change, an enum value removed, a narrowed allowed range, or an explicit change in side-effect/permission requirements. Missing MCP annotations cannot prove a tool is read-only; a description-text change can only prompt manual review and cannot by itself determine safety. When a comparison fails, write "cannot confirm" — never "no change".

## Implementation boundaries handed to P0

1. Prefer reusing the existing diagnostic `stage`, the stable `code`, `checkedAt`, the last success time and Host status; do not add covert user tracking for copy.
2. Separate "current check" from "last successful cache"; do not let one green status cover both.
3. Keep account/organization, cost and administrator requirements unknown when there is no reliable interface; do not parse tokens or automatically invoke paid/side-effecting tools to fill them in.
4. Invocation evidence should come from the Host's existing execution/approval contract or from redacted acceptance records explicitly provided by the user. This round does not add a bypass dry-run to the connector page.
5. Schema differences only take effect for the actually observable cache of the same connection signature/Server/tool; refreshing before a wide-range invocation, complete breaking-change determination, schema change approval binding and controlled write operations are follow-up design, and the copy must not imply they are already implemented.

See the [three first-success scenario packs](FIRST-SUCCESS-SCENARIOS.md) for the scenario record format.