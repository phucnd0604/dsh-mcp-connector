# Community Connector Registry (Tier 1)

This directory is the executable seed for the standalone `dsh-mcp-connector-registry` repository. Before the repository is split out, you can validate the Schema, the probe and the CI flow here.

Listing steps:

1. Copy `connectors/example.sample.json` to `connectors/<connector-id>.json` — one file per connector.
2. A connector descriptor may only contain public metadata; tokens, API keys, passwords and client secrets are forbidden.
   `stdio` servers use `command/args/env/cwd`; the `env` in the catalog may only hold non-sensitive defaults, and user credentials must be configured on the local machine.
3. Run `npm run registry:build`, then run `npm run registry:validate`.
4. PRs run the offline gate; scheduled jobs and manual workflows run the public endpoint connectivity probe.
5. `featured` is set by maintainers only; regular community connectors keep `featured:false`.

The probe only reads public endpoints. It never registers an OAuth client, never starts a user authorization flow, never stores credentials, and never executes the stdio commands in the catalog. `stdio` servers are launched by `dsh-mcp-client` after installation; `partial` means the MCP endpoint is reachable but the OAuth metadata or the icon still needs manual review; `fail` blocks the listing.