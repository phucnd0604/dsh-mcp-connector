window.__ModuleLoader__.load({
	id: "dsh-mcp-connector",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let react_dom = require("react-dom");

		/** Services the client needs: slots, workspaces, sessions, and the conversation input shell. */
		const inject = [
			"slots",
			"sessions",
			"workspaces",
			"conversation"
		];
		const PROMPT_REQUEST_TYPE = "mcp-connector:start-session";
		const PROMPT_RESULT_TYPE = "mcp-connector:start-session-result";
		const WORKSPACE_CONTEXT_REQUEST_TYPE = "mcp-connector:workspace-context-request";
		const WORKSPACE_CONTEXT_RESULT_TYPE = "mcp-connector:workspace-context";
		const VERSION_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1e3;
		const VERSION_CHECK_RETRY_MS = 5 * 60 * 1e3;
		const NPM_PACKAGE_URL = "https://www.npmjs.com/package/dsh-mcp-connector";
		const PLUGIN_PACKAGE_NAME = "dsh-mcp-connector";
		const CONNECTOR_SETTINGS_NAMESPACE = "mcp-connector";
		const SHOW_SIDEBAR_ENTRY_FIELD = "showSidebarEntry";
		const CONNECTOR_MODAL_Z_INDEX = 1100;
		const UPDATE_PROVIDER_OPERATION_POLL_MS = 1e3;
		const UPDATE_PROVIDER_ADAPTERS = Object.freeze([
			createHttpUpdateProviderAdapter({
				id: "dsh-market-v1",
				label: "DSH Market",
				schema: "dsh-market/update-api/v1",
				apiVersion: 1,
				capabilitiesUrl: "/dsh-market/api/v1/capabilities"
			})
		]);

		/**
		 * Styles for the sidebar.footer.action compatibility entry in DSH 0.1.x. Newer hosts use
		 * native sidebar.panellist rows and never install this CSS. The compatibility adapter only
		 * styles this plugin node, and never rewrites public slots or other plugin items (#124).
		 */
		const SIDEBAR_STYLE_ID = "dsh-mcp-connector-sidebar";
		const sidebarCss = `
.mcpConnectorLauncher {
	flex: none;
	display: flex;
	align-items: center;
	box-sizing: border-box;
	width: 100%;
	height: 42px;
	margin: 4px 0;
	padding: 0 var(--dsh-sidebar-inline-padding, 12px);
	gap: 8px;
	justify-content: flex-start;
	overflow: hidden;
	border: 0;
	border-radius: 12px;
	background: transparent;
	color: inherit;
	font: inherit;
	white-space: nowrap;
	cursor: pointer;
}

.mcpConnectorLauncher[data-placement="footer"] {
	flex: 1 1 0;
	width: auto;
	min-width: 0;
	max-width: 100%;
}

.mcpConnectorLauncher:hover {
	background: rgba(127, 127, 127, 0.12);
	outline: none;
}

.mcpConnectorLauncher:focus-visible {
	background: rgba(127, 127, 127, 0.12);
	outline: 2px solid currentColor;
	outline-offset: -2px;
}

.mcpConnectorLauncherIcon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex: 0 0 20px;
	width: 20px;
	height: 20px;
	color: inherit;
}

.mcpConnectorLauncherIcon > svg {
	display: block;
	width: 18px;
	height: 18px;
}

.mcpConnectorLauncherLabel {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
}

.mcpConnectorLauncher[data-wide="false"] {
	flex: none;
	width: 36px;
	height: 36px;
	margin: 8px 0 10px;
	padding: 0;
	justify-content: center;
	border-radius: 50%;
}

.mcpConnectorTopMount {
	flex: none;
	min-width: 0;
	width: 100%;
}

.mcpConnectorTopEntry {
	box-sizing: border-box;
	width: 100%;
	padding-right: var(--dsh-sidebar-inline-padding, 12px);
}

.mcpConnectorTopEntry .mcpConnectorLauncher {
	width: 100%;
	margin: 0 0 8px;
}

.mcpConnectorTopEntry[data-wide="false"] {
	width: 36px;
	padding-right: 0;
}

.mcpConnectorTopEntry[data-wide="false"] .mcpConnectorLauncher {
	margin: 0 0 8px;
}
`;
		const OVERLAY_STYLE_ID = "dsh-mcp-connector-overlay";
		const overlayCss = `

.mcpConnectorMarketPanel { background: #ffffff; color: #111827; }
.mcpConnectorMarketHeader { border-color: #e5e7eb; }
.mcpConnectorMarketTitle { color: #111827; }
.mcpConnectorMarketIcon {
	display: inline-flex;
	align-items: center;
	color: inherit;
}
.mcpConnectorMarketIcon > svg {
	display: block;
	width: 18px;
	height: 18px;
}
.mcpConnectorVersion {
	color: #6b7280;
	background: #f3f4f6;
	border-radius: 999px;
	padding: 2px 8px;
	font-size: 12px;
	font-weight: 600;
}
.mcpConnectorUpdateButton {
	color: #4338ca;
	background: #eef2ff;
	border: 1px solid #c7d2fe;
	border-radius: 8px;
	padding: 5px 9px;
	font: inherit;
	font-size: 12px;
	font-weight: 600;
	cursor: pointer;
}
.mcpConnectorUpdateButton:hover,
.mcpConnectorUpdateButton:focus-visible {
	background: #e0e7ff;
	outline: 2px solid #6366f1;
	outline-offset: 1px;
}
.mcpConnectorUpdateButton:disabled {
	opacity: 0.65;
	cursor: wait;
}
.mcpConnectorUpdateControls {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
}
.mcpConnectorManualUpdate {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
	flex: 1 1 360px;
}
.mcpConnectorManualCommand {
	box-sizing: border-box;
	min-width: 0;
	max-width: 430px;
	overflow-x: auto;
	padding: 5px 8px;
	color: #374151;
	background: #f9fafb;
	border: 1px solid #d1d5db;
	border-radius: 8px;
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	font-size: 11px;
	line-height: 1.35;
	white-space: nowrap;
	user-select: text;
}
.mcpConnectorUpdateStatus {
	max-width: 240px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: #166534;
	background: #f0fdf4;
	border-radius: 999px;
	padding: 3px 8px;
	font-size: 12px;
	font-weight: 600;
}
.mcpConnectorUpdateStatus[data-tone="error"] {
	color: #b91c1c;
	background: #fef2f2;
}
.mcpConnectorUpdateSecondary {
	color: #4b5563;
	background: transparent;
	border-color: #d1d5db;
}
.mcpConnectorMarketClose { color: #6b7280; }
.mcpConnectorMarketClose:hover,
.mcpConnectorMarketClose:focus-visible {
	background: #f3f4f6 !important;
	color: #111827;
	outline: 2px solid #6366f1;
	outline-offset: 1px;
}

@media (prefers-color-scheme: dark) {
	.mcpConnectorMarketPanel { background: #1b1e25; color: #f3f4f6; }
	.mcpConnectorMarketHeader { border-color: #30343d; }
	.mcpConnectorMarketTitle { color: #f3f4f6; }
	.mcpConnectorVersion { color: #d1d5db; background: #30343d; }
	.mcpConnectorUpdateButton { color: #c7d2fe; background: #312e81; border-color: #4f46e5; }
	.mcpConnectorUpdateButton:hover,
	.mcpConnectorUpdateButton:focus-visible { background: #3730a3; }
	.mcpConnectorUpdateStatus { color: #bbf7d0; background: #14532d; }
	.mcpConnectorUpdateStatus[data-tone="error"] { color: #fecaca; background: #7f1d1d; }
	.mcpConnectorManualCommand { color: #e5e7eb; background: #111827; border-color: #4b5563; }
	.mcpConnectorUpdateSecondary { color: #d1d5db; background: transparent; border-color: #4b5563; }
	.mcpConnectorMarketClose { color: #c4c8d0; }
	.mcpConnectorMarketClose:hover,
	.mcpConnectorMarketClose:focus-visible { background: #30343d !important; color: #ffffff; }
}
`;
		const SETTINGS_STYLE_ID = "dsh-mcp-connector-settings";
		const settingsCss = `
.mcpConnectorSettingsCard {
	border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
	background: var(--dsw-alias-bg-layer-3, transparent);
	border-radius: 12px;
	list-style: none;
}
.mcpConnectorSettingsCard[data-open="true"] {
	background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.06));
	border-color: var(--dsw-alias-label-dimmed, rgba(127, 127, 127, 0.5));
}
.mcpConnectorSettingsHeader {
	appearance: none;
	display: flex;
	align-items: center;
	gap: 12px;
	width: 100%;
	padding: 14px 16px;
	border: 0;
	border-radius: 12px;
	color: inherit;
	background: transparent;
	font: inherit;
	text-align: left;
	cursor: pointer;
}
.mcpConnectorSettingsHeader:focus-visible,
.mcpConnectorSettingsButton:focus-visible,
.mcpConnectorSettingsSwitch:focus-visible {
	outline: 2px solid var(--dsw-alias-brand-primary, currentColor);
	outline-offset: 2px;
}
.mcpConnectorSettingsHeadText {
	display: flex;
	flex: 1;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
}
.mcpConnectorSettingsName {
	color: var(--dsw-alias-label-primary, inherit);
	font-size: 15px;
	font-weight: 600;
	line-height: 1.4;
}
.mcpConnectorSettingsDescription,
.mcpConnectorSettingsHint,
.mcpConnectorSettingsState {
	color: var(--dsw-alias-label-tertiary, rgba(127, 127, 127, 0.9));
	font-size: 13px;
	line-height: 1.5;
}
.mcpConnectorSettingsChevron {
	flex: none;
	color: var(--dsw-alias-label-tertiary, currentColor);
	font-size: 16px;
	transition: transform 0.16s;
}
.mcpConnectorSettingsCard[data-open="true"] .mcpConnectorSettingsChevron {
	transform: rotate(180deg);
}
.mcpConnectorSettingsBody {
	margin: 0 16px;
	padding: 14px 0 10px;
	border-top: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
}
.mcpConnectorSettingsRow {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	align-items: center;
	gap: 18px;
}
.mcpConnectorSettingsLabel {
	display: block;
	color: var(--dsw-alias-label-primary, inherit);
	font-size: 14px;
	font-weight: 600;
}
.mcpConnectorSettingsHint {
	display: block;
	margin-top: 5px;
}
.mcpConnectorSettingsSwitch {
	position: relative;
	appearance: none;
	width: 42px;
	height: 24px;
	margin: 0;
	border: 0;
	border-radius: 999px;
	background: var(--dsw-alias-fill-secondary, rgba(127, 127, 127, 0.35));
	cursor: pointer;
	transition: background 0.16s;
}
.mcpConnectorSettingsSwitch::after {
	position: absolute;
	top: 3px;
	left: 3px;
	width: 18px;
	height: 18px;
	border-radius: 50%;
	background: #ffffff;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
	content: "";
	transition: transform 0.16s;
}
.mcpConnectorSettingsSwitch:checked {
	background: var(--dsw-alias-state-success, #16a34a);
}
.mcpConnectorSettingsSwitch:checked::after {
	transform: translateX(18px);
}
.mcpConnectorSettingsSwitch:disabled {
	cursor: default;
	opacity: 0.55;
}
.mcpConnectorSettingsFooter {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
	margin-top: 14px;
	padding-top: 12px;
	border-top: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
}
.mcpConnectorSettingsState {
	flex: 1 1 210px;
	margin: 0;
}
.mcpConnectorSettingsState[data-tone="error"] {
	color: var(--dsw-alias-label-error, #b91c1c);
}
.mcpConnectorSettingsButton {
	appearance: none;
	padding: 6px 12px;
	border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28));
	border-radius: 8px;
	color: var(--dsw-alias-label-secondary, inherit);
	background: transparent;
	font: inherit;
	font-size: 13px;
	cursor: pointer;
}
.mcpConnectorSettingsButton[data-primary="true"] {
	border-color: transparent;
	color: var(--dsw-alias-bg-layer-3, #ffffff);
	background: var(--dsw-alias-label-primary, #111827);
}
.mcpConnectorSettingsButton:disabled {
	cursor: default;
	opacity: 0.45;
}
@media (max-width: 520px) {
	.mcpConnectorSettingsRow { grid-template-columns: 1fr; }
	.mcpConnectorSettingsFooter .mcpConnectorSettingsButton { flex: 1 1 140px; }
}
`;
		const SIDEBAR_WORKSPACES_SELECTOR = '[data-slot="sidebar.workspaces"]';
		const TOP_MOUNT_SELECTOR = '[data-mcp-connector-top-mount="true"]';

		function installStyles(id, css) {
			if (document.querySelector(`style[data-plugin="${id}"]`) !== null) return () => {};
			const style = document.createElement("style");
			style.dataset.plugin = id;
			style.textContent = css;
			document.head.append(style);
			return () => { style.remove(); };
		}

		function installSidebarStyles() {
			return installStyles(SIDEBAR_STYLE_ID, sidebarCss);
		}

		function installOverlayStyles() {
			return installStyles(OVERLAY_STYLE_ID, overlayCss);
		}

		function installSettingsStyles() {
			return installStyles(SETTINGS_STYLE_ID, settingsCss);
		}

		/**
		 * DSH rc.7 exposes no public slot between "New session" and the workspace list. The plugin
		 * still registers in the public footer list slot to keep its lifecycle and fallbacks, then
		 * portals the real button in front of sidebar.workspaces. It relies only on the stable data-slot.
		 */
		function ensureTopLauncherMount() {
			const workspaceSlot = document.querySelector(SIDEBAR_WORKSPACES_SELECTOR);
			const parent = workspaceSlot?.parentElement;
			if (workspaceSlot === null || parent === null || parent === void 0) return null;
			let mount = parent.querySelector(TOP_MOUNT_SELECTOR);
			if (mount === null) {
				mount = document.createElement("div");
				mount.dataset.mcpConnectorTopMount = "true";
				mount.className = "mcpConnectorTopMount";
			}
			if (mount.nextSibling !== workspaceSlot) parent.insertBefore(mount, workspaceSlot);
			return mount;
		}

		async function fetchVersionStatus(force = false) {
			const response = await window.fetch("/mcp-connector/api", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ method: "versionStatus", params: { force } })
			});
			const result = await response.json();
			if (!response.ok || result.ok !== true || result.detail === void 0) {
				throw new Error(result.message ?? `HTTP ${response.status}`);
			}
			return result.detail;
		}

		/**
		 * An update provider may only advertise same-origin endpoints on the current DSH page.
		 * This boundary stops the Connector from passing install commands cross-origin, and it lets
		 * later marketplace adapters reuse the same client.
		 */
		function sameOriginProviderEndpoint(value) {
			if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;
			try {
				const url = new URL(value, window.location.origin);
				if (url.origin !== window.location.origin || url.search !== "" || url.hash !== "") return null;
				return url.pathname;
			} catch {
				return null;
			}
		}

		/**
		 * Adapts a versioned same-origin HTTP update protocol into a Connector-wide capability.
 * The UI never touches vendor routing or response wrapping; a new market only needs an adapter.
		 */
		function createHttpUpdateProviderAdapter(options) {
			const { id, label, schema, apiVersion, capabilitiesUrl } = options;
			async function readResponse(response) {
				let result;
				try {
					result = await response.json();
				} catch {
					result = null;
				}
				if (!response.ok) {
					const error = new Error(result?.error ?? result?.failure?.message ?? `HTTP ${response.status}`);
					error.code = result?.failure?.code ?? `HTTP_${response.status}`;
					error.retryable = result?.failure?.retryable === true;
					throw error;
				}
				if (result?.schema !== schema) throw new Error(`${label} update API version is incompatible`);
				return result;
			}

			async function post(path, body) {
				return readResponse(await window.fetch(path, {
					method: "POST",
					headers: { accept: "application/json", "content-type": "application/json" },
					body: JSON.stringify(body)
				}));
			}

			return Object.freeze({
				id,
				label,
				async probe() {
					const response = await window.fetch(capabilitiesUrl, { headers: { accept: "application/json" } });
					if (response.status === 404) return null;
					const result = await readResponse(response);
					if (result.apiVersion !== apiVersion || result.features?.update !== true) return null;
					const endpoints = {
						updates: sameOriginProviderEndpoint(result.endpoints?.updates),
						operations: sameOriginProviderEndpoint(result.endpoints?.operations),
						rollback: sameOriginProviderEndpoint(result.endpoints?.rollback),
						restart: sameOriginProviderEndpoint(result.endpoints?.restart)
					};
					if (endpoints.updates === null || endpoints.operations === null) return null;
					if (result.features?.rollback === true && endpoints.rollback === null) return null;
					if (result.restart?.supported === true && endpoints.restart === null) return null;
					return {
						providerId: id,
						providerLabel: label,
						runtime: result.runtime,
						features: result.features,
						restart: result.restart,
						endpoints
					};
				},
				async check(capabilities, packageName, force = false) {
					const query = new URLSearchParams({ name: packageName });
					if (force) query.set("force", "1");
					const result = await readResponse(await window.fetch(`${capabilities.endpoints.updates}?${query}`, {
						headers: { accept: "application/json" }
					}));
					return result.package;
				},
				async start(capabilities, packageName, force = false) {
					const result = await post(capabilities.endpoints.updates, {
						packageName,
						...(force ? { force: true } : {})
					});
					if (typeof result.operation?.operationId !== "string") {
						throw new Error(`${label} did not return an update operation id`);
					}
					return result.operation;
				},
				async operation(capabilities, operationId) {
					const query = new URLSearchParams({ operationId });
					const result = await readResponse(await window.fetch(`${capabilities.endpoints.operations}?${query}`, {
						headers: { accept: "application/json" }
					}));
					return result.operation;
				},
				async rollback(capabilities, operationId) {
					if (capabilities.endpoints.rollback === null) throw new Error(`${label} does not support rollback`);
					const result = await post(capabilities.endpoints.rollback, { operationId });
					return result.operation;
				},
				async restart(capabilities) {
					if (capabilities.endpoints.restart === null) throw new Error(`${label} does not support restart`);
					return post(capabilities.endpoints.restart, {});
				}
			});
		}

		async function discoverUpdateProvider(packageName, force = false) {
			for (const provider of UPDATE_PROVIDER_ADAPTERS) {
				try {
					const capabilities = await provider.probe();
					if (capabilities === null) continue;
					const update = await provider.check(capabilities, packageName, force);
					return { provider, capabilities, update };
				} catch (error) {
					console.warn(`[mcp-connector] ${provider.id} update provider unavailable:`, error);
				}
			}
			return null;
		}

		function updateProgressLabel(operation) {
			if (operation?.state === "queued") return "Update queued…";
			const percent = operation?.progress?.percent;
			if (typeof percent === "number") return `Updating ${percent}%`;
			const phase = operation?.progress?.phase;
			if (typeof phase === "string" && phase !== "") return `Updating: ${phase}`;
			return "Updating…";
		}

		function updateFailureLabel(failure) {
			const labels = {
				AGENTS_RUNNING: "Another task is running. Please finish it and try again",
				OPERATION_BUSY: "The plugin marketplace is handling another task",
				RELEASE_TOO_FRESH: "The new release is still in its safety wait period (about 24 hours)",
				MIRROR_SYNC_PENDING: "The mirror has not synced the full package yet",
				VERSION_UNCHANGED: "The version did not change after the download",
				DOWNGRADE_DETECTED: "The version downgrade was blocked",
				RESOLVED_VERSION_MISMATCH: "The downloaded version does not match the expected one",
				INVALID_UPDATE_RESULT: "The update service did not return a valid version",
				UPDATE_TIMEOUT: "The update timed out",
				UPDATE_FORBIDDEN: "The update request was rejected",
				UPDATE_REJECTED: "This update could not be performed"
			};
			return labels[failure?.code] ?? failure?.message ?? "Update failed";
		}

		function manualUpgradeCommand(version) {
			const parsed = parseClientVersion(version);
			if (parsed === null) return null;
			return `dsh plugin --profile web add --config.minimumReleaseAge=0 ${PLUGIN_PACKAGE_NAME}@${parsed.normalized}`;
		}

		async function copyManualUpgradeCommand(command) {
			if (typeof window.navigator?.clipboard?.writeText === "function") {
				await window.navigator.clipboard.writeText(command);
				return true;
			}
			window.prompt?.("Copy the upgrade command below", command);
			return false;
		}

		function parseClientVersion(value) {
			if (typeof value !== "string") return null;
			const normalized = value.trim().replace(/^v/i, "");
			if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(normalized)) return null;
			const [withoutBuild] = normalized.split("+");
			const [core, prerelease] = withoutBuild.split("-", 2);
			return { normalized, core: core.split(".").map(Number), prerelease: prerelease?.split(".") ?? [] };
		}

		function compareClientVersions(left, right) {
			const a = parseClientVersion(left);
			const b = parseClientVersion(right);
			if (a === null || b === null) return null;
			for (let index = 0; index < 3; index += 1) {
				if (a.core[index] !== b.core[index]) return a.core[index] - b.core[index];
			}
			if (a.prerelease.length === 0 && b.prerelease.length > 0) return 1;
			if (a.prerelease.length > 0 && b.prerelease.length === 0) return -1;
			const length = Math.max(a.prerelease.length, b.prerelease.length);
			for (let index = 0; index < length; index += 1) {
				const aPart = a.prerelease[index];
				const bPart = b.prerelease[index];
				if (aPart === void 0) return -1;
				if (bPart === void 0) return 1;
				if (aPart === bPart) continue;
				const aNumeric = /^\d+$/.test(aPart);
				const bNumeric = /^\d+$/.test(bPart);
				if (aNumeric && bNumeric) return Number(aPart) - Number(bPart);
				if (aNumeric) return -1;
				if (bNumeric) return 1;
				return aPart.localeCompare(bPart);
			}
			return 0;
		}

		/**
		 * The provider reads the on-disk version from the profile, while versionStatus comes from the
		 * currently running plugin process. When the on-disk version is higher and the provider reports no
		 * further update, the install is complete and only needs a restart to activate.
		 */
		function pendingActivationVersion(versionStatus, providerUpdateCheck) {
			if (providerUpdateCheck?.updateAvailable !== false) return null;
			const running = parseClientVersion(versionStatus?.installedVersion);
			const installed = parseClientVersion(providerUpdateCheck?.installedVersion);
			if (running === null || installed === null) return null;
			return compareClientVersions(installed.normalized, running.normalized) > 0
				? installed.normalized
				: null;
		}

		/** Independently verify a provider's terminal success before asking the user to restart. */
		function completedUpdateIntegrityFailure(operation, expectedVersion) {
			if (operation?.state !== "succeeded") return null;
			const installed = parseClientVersion(operation.installedVersion);
			if (installed === null) {
				return {
					code: "INVALID_UPDATE_RESULT",
					message: "The update service reported success but did not return a valid installed version",
					retryable: false
				};
			}
			const before = parseClientVersion(operation.beforeVersion);
			if (before !== null && compareClientVersions(installed.normalized, before.normalized) < 0) {
				return {
					code: "DOWNGRADE_DETECTED",
					message: `The update service downgraded the plugin from v${before.normalized} to v${installed.normalized}`,
					retryable: false
				};
			}
			const expected = parseClientVersion(expectedVersion);
			if (expected !== null && compareClientVersions(installed.normalized, expected.normalized) !== 0) {
				return {
					code: "RESOLVED_VERSION_MISMATCH",
					message: `Expected v${expected.normalized} to be installed, but the update service installed v${installed.normalized}`,
					retryable: true
				};
			}
			return null;
		}

		/**
		 * DSH does not expose an "open a specific settings section" service yet, so the plugin marketplace
		 * is opened through the stable sidebar.settings slot and accessible text alone. Desktop may
		 * not have a marketplace section at all, so once polling ends the flow must fall back to the
		 * npm install instructions instead of leaving the user on the plain settings page.
		 */
		function openDshPluginMarket(actions) {
			const settingsHost = document.querySelector('[data-slot="sidebar.settings"]');
			const settingsTrigger = settingsHost?.querySelector?.('button[aria-haspopup="dialog"]');
			if (settingsTrigger === null || settingsTrigger === void 0) {
				window.open(NPM_PACKAGE_URL, "_blank", "noopener,noreferrer");
				return;
			}
			actions.close();
			window.setTimeout(() => {
				settingsTrigger.click();
				let attempts = 0;
				const selectMarket = () => {
					const marketButton = [...document.querySelectorAll('[role="dialog"] nav button')].find((button) => {
						const label = button.textContent?.trim() ?? "";
						return /^(\u63d2\u4ef6\u5e02\u573a|Plugin Market|Plugin Marketplace)$/i.test(label);
					});
					if (marketButton !== void 0) {
						marketButton.click();
						return;
					}
					attempts += 1;
					if (attempts < 20) {
						window.setTimeout(selectMarket, 50);
						return;
					}
					window.open(NPM_PACKAGE_URL, "_blank", "noopener,noreferrer");
				};
				window.requestAnimationFrame(selectMarket);
			}, 0);
		}

		/**
		 * Creates a local state handle that satisfies the DSH Slot Store contract.
		 * It depends only on getSnapshot/subscribe/actions, so neither the store package name of another
 * host version nor the arrival order of client modules can push Desktop into Safe Mode.
		 */
		function createMarketViewStore() {
			let sidebarVisible = true;
			const liveActions = new Set();
			const visibilityListeners = new Set();
			const spec = {
				init: () => ({ open: false, detailOpen: false, sidebarVisible }),
				actions: {
					open: (draft) => { draft.open = true; },
					close: (draft) => { draft.open = false; draft.detailOpen = false; },
					detailOpened: (draft) => { draft.detailOpen = true; },
					detailClosed: (draft) => { draft.detailOpen = false; },
					setSidebarVisible: (draft, visible) => { draft.sidebarVisible = visible !== false; }
				}
			};
			return {
				spec,
				getSidebarVisible() {
					return sidebarVisible;
				},
				subscribeSidebarVisible(listener) {
					visibilityListeners.add(listener);
					return () => { visibilityListeners.delete(listener); };
				},
				syncSidebarVisible(visible) {
					const next = visible !== false;
					if (sidebarVisible === next) return;
					sidebarVisible = next;
					for (const actions of liveActions) actions.setSidebarVisible(sidebarVisible);
					for (const listener of visibilityListeners) listener(sidebarVisible);
				},
				create() {
					let state = spec.init();
					const listeners = new Set();
					const actions = {};
					for (const [name, mutate] of Object.entries(spec.actions)) {
						actions[name] = (...params) => {
							const draft = { ...state };
							mutate(draft, ...params);
							state = draft;
							for (const listener of listeners) listener();
						};
					}
					liveActions.add(actions);
					return {
						actions,
						getSnapshot: () => state,
						subscribe(listener) {
							listeners.add(listener);
							return () => { listeners.delete(listener); };
						},
						clearPersisted() {
							liveActions.delete(actions);
							listeners.clear();
						}
					};
				}
			};
		}

		function resolveSidebarVisible(snapshot) {
			return snapshot?.status === "ready"
				? snapshot.value?.[SHOW_SIDEBAR_ENTRY_FIELD] !== false
				: true;
		}

		function connectorSettingsCopy() {
			const language = document.documentElement?.lang || window.navigator?.language || "zh";
			if (String(language).toLowerCase().startsWith("en")) {
				return {
					title: "MCP Connector",
					description: "Control how the MCP Connector is opened.",
					show: "Show MCP Connector in the sidebar",
					hint: "Turning this off only hides the shortcut. Connected MCP servers and tools remain available.",
					visible: "The sidebar shortcut is visible.",
					hidden: "The shortcut is hidden. You can still open MCP Connector here.",
					readOnly: "This settings page is read-only.",
					saving: "Saving…",
					failed: "The setting was not saved. Please try again.",
					reset: "Reset",
					open: "Open MCP Connector",
					expand: "Expand MCP Connector settings",
					collapse: "Collapse MCP Connector settings"
				};
			}
			return {
				title: "MCP Connector",
				description: "Control the sidebar entry and how to open it quickly.",
				show: "Show MCP Connector in the sidebar",
				hint: "Turning this off only hides the entry; connected MCP Servers and tools are not affected.",
				visible: "The sidebar entry is currently visible.",
				hidden: "The entry is hidden. You can still open MCP Connector from here.",
				readOnly: "This settings page is read-only.",
				saving: "Saving…",
				failed: "The setting was not saved. Please try again.",
				reset: "Reset to default",
				open: "Open MCP Connector",
				expand: "Expand MCP Connector settings",
				collapse: "Collapse MCP Connector settings"
			};
		}

		function ConnectorSettingsCard(props) {
			const { settingsScope, actions } = props;
			const copy = connectorSettingsCopy();
			const snapshot = (0, react.useSyncExternalStore)(
				(listener) => settingsScope.subscribe(listener),
				() => settingsScope.getSnapshot()
			);
			const [open, setOpen] = (0, react.useState)(false);
			const [saving, setSaving] = (0, react.useState)(false);
			const [failed, setFailed] = (0, react.useState)(false);
			if (snapshot.status !== "ready") return null;
			const visible = resolveSidebarVisible(snapshot);
			const writable = snapshot.writable === true;
			const overridden = snapshot.user !== null
				&& typeof snapshot.user === "object"
				&& Object.prototype.hasOwnProperty.call(snapshot.user, SHOW_SIDEBAR_ENTRY_FIELD);

			const save = async (next) => {
				setSaving(true);
				setFailed(false);
				try {
					await settingsScope.set(SHOW_SIDEBAR_ENTRY_FIELD, next);
					const confirmed = settingsScope.getSnapshot();
					setFailed(confirmed.status !== "ready" || resolveSidebarVisible(confirmed) !== next);
				} catch (error) {
					console.error("[mcp-connector] sidebar setting update failed:", error);
					setFailed(true);
				} finally {
					setSaving(false);
				}
			};

			const reset = async () => {
				setSaving(true);
				setFailed(false);
				try {
					await settingsScope.unset(SHOW_SIDEBAR_ENTRY_FIELD);
					const confirmed = settingsScope.getSnapshot();
					const stillOverridden = confirmed.user !== null
						&& typeof confirmed.user === "object"
						&& Object.prototype.hasOwnProperty.call(confirmed.user, SHOW_SIDEBAR_ENTRY_FIELD);
					setFailed(confirmed.status !== "ready" || stillOverridden);
				} catch (error) {
					console.error("[mcp-connector] sidebar setting reset failed:", error);
					setFailed(true);
				} finally {
					setSaving(false);
				}
			};

			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: "mcpConnectorSettingsCard",
				"data-open": open,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "mcpConnectorSettingsHeader",
						"aria-expanded": open,
						"aria-label": open ? copy.collapse : copy.expand,
						onClick: () => { setOpen(!open); },
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "mcpConnectorSettingsHeadText",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "mcpConnectorSettingsName", children: copy.title }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "mcpConnectorSettingsDescription", children: copy.description })
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "mcpConnectorSettingsChevron", "aria-hidden": true, children: "⌄" })
						]
					}),
					open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "mcpConnectorSettingsBody",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "mcpConnectorSettingsRow",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										htmlFor: "mcp-connector-show-sidebar-entry",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "mcpConnectorSettingsLabel", children: copy.show }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "mcpConnectorSettingsHint", children: copy.hint })
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										id: "mcp-connector-show-sidebar-entry",
										className: "mcpConnectorSettingsSwitch",
										type: "checkbox",
										role: "switch",
										"aria-checked": visible,
										checked: visible,
										disabled: !writable || saving,
										onChange: (event) => { void save(event.target.checked); }
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "mcpConnectorSettingsFooter",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "mcpConnectorSettingsState",
										"data-tone": failed ? "error" : "normal",
										role: failed ? "alert" : "status",
										children: failed ? copy.failed : saving ? copy.saving : !writable ? copy.readOnly : visible ? copy.visible : copy.hidden
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "mcpConnectorSettingsButton",
										disabled: !writable || saving || !overridden,
										onClick: () => { void reset(); },
										children: copy.reset
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "mcpConnectorSettingsButton",
										"data-primary": true,
										"aria-haspopup": "dialog",
										onClick: () => { actions.open(); },
										children: copy.open
									})
								]
							})
						]
					}) : null
				]
			});
		}

		function installClientSettings(ctx, marketView) {
			if (typeof ctx.inject !== "function") return;
			ctx.inject(["settingsScope"], (settingsCtx) => {
				if (typeof settingsCtx?.settingsScope?.bind !== "function") return;
				const settingsScope = settingsCtx.settingsScope.bind({
					namespace: CONNECTOR_SETTINGS_NAMESPACE,
					decode(value) {
						if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
						return typeof value[SHOW_SIDEBAR_ENTRY_FIELD] === "boolean"
							? { [SHOW_SIDEBAR_ENTRY_FIELD]: value[SHOW_SIDEBAR_ENTRY_FIELD] }
							: void 0;
					}
				});
				if (typeof settingsScope?.getSnapshot !== "function"
					|| typeof settingsScope?.subscribe !== "function") return;
				settingsCtx.effect(() => {
					const sync = () => { marketView.syncSidebarVisible(resolveSidebarVisible(settingsScope.getSnapshot())); };
					sync();
					const unsubscribe = settingsScope.subscribe(sync);
					return () => {
						unsubscribe();
						marketView.syncSidebarVisible(true);
					};
				}, "mcp-connector: sidebar visibility setting");
				settingsCtx.effect(() => installSettingsStyles(), "mcp-connector: settings styles");
				settingsCtx.slots.inject("settings.plugin.item", () => settingsCtx.slots.register({
					name: "settings.plugin.item",
					key: CONNECTOR_SETTINGS_NAMESPACE,
					store: marketView,
					inject: () => ({ settingsScope })
				}, ConnectorSettingsCard));
			});
		}

		/**
		 * Carries the sample prompt into a new session using the host workspace, session, and input services.
		 * connectWorkspace is the same path as the DSH "New session" button: it reuses the blank
		 * session of the current workspace when there is one and creates one otherwise. The returned
		 * binding is already ready, so the draft can be written before navigating.
		 */
		function currentWorkspaceContext(ctx) {
			const workspace = ctx.workspaces.list.getSnapshot();
			const current = ctx.sessions.list.getSnapshot().current;
			const selected = current === void 0
				? void 0
				: workspace.items.find((item) => item.sessionIds.includes(current));
			const targetWorkspaceId = selected?.workspaceId ?? workspace.recentWorkspaceId;
			const target = workspace.items.find((item) => item.workspaceId === targetWorkspaceId);
			return targetWorkspaceId === void 0 ? null : {
				workspaceId: targetWorkspaceId,
				title: target?.title ?? String(targetWorkspaceId)
			};
		}

		function availableWorkspaceContexts(ctx) {
			const items = ctx.workspaces.list.getSnapshot()?.items;
			if (!Array.isArray(items)) return [];
			const workspaces = new Map();
			for (const item of items) {
				if (typeof item?.workspaceId !== "string" || item.workspaceId === "") continue;
				workspaces.set(item.workspaceId, {
					workspaceId: item.workspaceId,
					title: item.title ?? String(item.workspaceId)
				});
			}
			return [...workspaces.values()];
		}

		async function startPromptSession(ctx, promptText) {
			if (typeof promptText !== "string" || promptText.trim() === "") {
				throw new Error("The prompt must not be empty");
			}
			const targetWorkspaceId = currentWorkspaceContext(ctx)?.workspaceId;
			if (targetWorkspaceId === void 0) {
				throw new Error("Select a workspace before using the sample prompt");
			}
			// DSH 0.1.2 moved the cross-controller navigation capability from workspaces to
			// uiWorkspace, while 0.1.1 Desktop still exposes the old method. Prefer the currently
			// published capability, then fall back to the older version, and finally use sessions.create
			// so a native session is still created in the target workspace once the bridging
			// methods are removed in the future.
			const uiWorkspace = typeof ctx.get === "function"
				? ctx.get("uiWorkspace")
				: ctx.uiWorkspace;
			let sessionId;
			if (typeof uiWorkspace?.connectWorkspace === "function") {
				sessionId = await uiWorkspace.connectWorkspace(targetWorkspaceId);
			} else if (typeof ctx.workspaces?.connectWorkspace === "function") {
				sessionId = await ctx.workspaces.connectWorkspace(targetWorkspaceId);
			} else if (typeof ctx.sessions?.create === "function") {
				sessionId = await ctx.sessions.create({ workspaceId: targetWorkspaceId });
			} else {
				throw new Error("This DSH version cannot create a workspace session. Please upgrade DSH and try again");
			}
			const conversation = ctx.get("conversation");
			if (conversation === void 0) {
				throw new Error("The DSH conversation service is not ready yet. Please try again later");
			}
			conversation.input.shell(sessionId).setDraft(promptText);
			ctx.sessions.open(sessionId);
			return sessionId;
		}

		/** The marketplace body, shared by the native main panel and the settings quick dialog. */
		function MarketOverlay(props) {
			const {
				wide,
				useStore,
				actions,
				presentation = "modal",
				closePanel = null,
				startPromptSession: launchPromptSession,
				workspaceContext = () => null,
				workspaceOptions = () => []
			} = props;
			const modalOpen = useStore((state) => state.open);
			const open = presentation === "panel" || modalOpen;
			const closeView = () => {
				if (presentation === "panel") closePanel?.();
				else actions.close();
			};
			const detailOpen = useStore((state) => state.detailOpen);
			const [versionStatus, setVersionStatus] = (0, react.useState)(null);
			const [updateProviderState, setUpdateProviderState] = (0, react.useState)("checking");
			const [updateProviderSelection, setUpdateProviderSelection] = (0, react.useState)(null);
			const [providerUpdateCheck, setProviderUpdateCheck] = (0, react.useState)(null);
			const [expectedUpdateVersion, setExpectedUpdateVersion] = (0, react.useState)(null);
			const [updateOperation, setUpdateOperation] = (0, react.useState)(null);
			const [updateError, setUpdateError] = (0, react.useState)(null);
			const [updateStarting, setUpdateStarting] = (0, react.useState)(false);
			const [rollbackRunning, setRollbackRunning] = (0, react.useState)(false);
			const [restarting, setRestarting] = (0, react.useState)(false);
			const [manualCommandCopied, setManualCommandCopied] = (0, react.useState)(false);
			const [versionCheckRequest, setVersionCheckRequest] = (0, react.useState)(0);
			const [versionCheckBusy, setVersionCheckBusy] = (0, react.useState)(false);
			const [versionCheckFailed, setVersionCheckFailed] = (0, react.useState)(false);
			const frameRef = (0, react.useRef)(null);
			const closeRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const sendWorkspaceContext = () => {
					frameRef.current?.contentWindow?.postMessage({
						type: WORKSPACE_CONTEXT_RESULT_TYPE,
						workspace: workspaceContext(),
						workspaces: workspaceOptions()
					}, window.location.origin);
				};
				const onMessage = (event) => {
					if (event.origin !== window.location.origin) return;
					if (event.source !== frameRef.current?.contentWindow) return;
					if (event.data?.type === "mcp-connector:detail-state") {
						if (event.data.open === true) actions.detailOpened();
						else actions.detailClosed();
						return;
					}
					if (event.data?.type === WORKSPACE_CONTEXT_REQUEST_TYPE) {
						sendWorkspaceContext();
						return;
					}
					if (event.data?.type !== PROMPT_REQUEST_TYPE) return;
					const requestId = typeof event.data.requestId === "string" ? event.data.requestId : "";
					const prompt = event.data.prompt;
					const reply = (ok, message) => {
						frameRef.current?.contentWindow?.postMessage({
							type: PROMPT_RESULT_TYPE,
							requestId,
							ok,
							message
						}, window.location.origin);
					};
					if (requestId === "" || typeof prompt !== "string") {
						reply(false, "Invalid prompt request");
						return;
					}
					Promise.resolve(launchPromptSession(prompt)).then(() => {
						reply(true, "The prompt was carried into the new session");
						window.requestAnimationFrame(closeView);
					}, (error) => {
						const message = error instanceof Error ? error.message : String(error);
						console.error("[mcp-connector] start prompt session failed:", error);
						reply(false, message);
					});
				};
				window.addEventListener("message", onMessage);
				return () => { window.removeEventListener("message", onMessage); };
			}, [actions, closePanel, launchPromptSession, presentation, workspaceContext]);
			(0, react.useEffect)(() => {
				if (!open) return void 0;
				let disposed = false;
				let pollTimer;
				const schedule = (delayMs) => {
					window.clearTimeout(pollTimer);
					pollTimer = window.setTimeout(check, Math.max(1e3, delayMs));
				};
				const check = (force = false) => {
					setVersionCheckBusy(true);
					fetchVersionStatus(force).then((status) => {
						if (disposed) return;
						setVersionStatus(status);
						setVersionCheckBusy(status.checking === true);
						setVersionCheckFailed(!status.checking && status.sources?.npm?.ok !== true);
						if (status.checking) {
							schedule(1e3);
							return;
						}
						const nextCheckAt = Date.parse(status.nextCheckAt ?? "");
						const delay = Number.isFinite(nextCheckAt)
							? Math.min(VERSION_CHECK_INTERVAL_MS, nextCheckAt - Date.now())
							: VERSION_CHECK_INTERVAL_MS;
						schedule(delay);
					}, (error) => {
						console.warn("[mcp-connector] plugin update check failed:", error);
						if (!disposed) {
							setVersionCheckBusy(false);
							setVersionCheckFailed(true);
							schedule(VERSION_CHECK_RETRY_MS);
						}
					});
				};
				check(true);
				return () => {
					disposed = true;
					window.clearTimeout(pollTimer);
				};
			}, [open, versionCheckRequest]);
			(0, react.useEffect)(() => {
				if (open) setManualCommandCopied(false);
			}, [open, versionStatus?.latestVersion]);
			(0, react.useEffect)(() => {
				if (!open) return void 0;
				let disposed = false;
				setUpdateProviderState("checking");
				discoverUpdateProvider(PLUGIN_PACKAGE_NAME, true).then((selection) => {
					if (disposed) return;
					if (selection === null) {
						setUpdateProviderSelection(null);
						setProviderUpdateCheck(null);
						setUpdateProviderState("unavailable");
						return;
					}
					setUpdateProviderSelection(selection);
					setProviderUpdateCheck(selection.update);
					setUpdateProviderState("ready");
				}).catch((error) => {
					console.warn("[mcp-connector] update provider discovery failed:", error);
					if (disposed) return;
					setUpdateProviderSelection(null);
					setProviderUpdateCheck(null);
					setUpdateProviderState("unavailable");
				});
				return () => { disposed = true; };
			}, [open, versionCheckRequest]);
			(0, react.useEffect)(() => {
				const operationId = updateOperation?.operationId;
				const provider = updateProviderSelection?.provider;
				const capabilities = updateProviderSelection?.capabilities;
				if (!open || provider === void 0 || capabilities === void 0
					|| typeof operationId !== "string" || !["queued", "running"].includes(updateOperation.state)) {
					return void 0;
				}
				let disposed = false;
				let timer;
				const poll = () => {
					provider.operation(capabilities, operationId).then((operation) => {
						if (disposed) return;
						setUpdateError(null);
						const integrityFailure = completedUpdateIntegrityFailure(operation, expectedUpdateVersion);
						if (integrityFailure !== null) {
							const failedOperation = { ...operation, state: "failed", failure: integrityFailure };
							setUpdateOperation(failedOperation);
							const canRollback = capabilities.features?.rollback === true
								&& operation.outcome?.rollback?.available === true
								&& capabilities.endpoints.rollback !== null;
							if (!canRollback) return;
							setRollbackRunning(true);
							provider.rollback(capabilities, operationId).then((rolledBackOperation) => {
								if (disposed) return;
								setRollbackRunning(false);
								setUpdateOperation({ ...rolledBackOperation, integrityFailure });
							}, (error) => {
								console.error("[mcp-connector] automatic rollback failed:", error);
								if (disposed) return;
								const detail = error instanceof Error ? error.message : String(error);
								setRollbackRunning(false);
								setUpdateOperation({
									...failedOperation,
									outcome: {
										...failedOperation.outcome,
										rollback: { available: true, state: "failed", detail }
									}
								});
							});
							return;
						}
						setUpdateOperation(operation);
						if (["queued", "running"].includes(operation.state)) {
							timer = window.setTimeout(poll, UPDATE_PROVIDER_OPERATION_POLL_MS);
							return;
						}
						if (operation.state === "succeeded") {
							provider.check(capabilities, PLUGIN_PACKAGE_NAME, true).then(setProviderUpdateCheck, () => {});
						}
					}, (error) => {
						console.warn("[mcp-connector] update operation polling failed:", error);
						if (disposed) return;
						setUpdateError(error instanceof Error ? error.message : String(error));
						timer = window.setTimeout(poll, UPDATE_PROVIDER_OPERATION_POLL_MS * 2);
					});
				};
				timer = window.setTimeout(poll, UPDATE_PROVIDER_OPERATION_POLL_MS);
				return () => {
					disposed = true;
					window.clearTimeout(timer);
				};
			}, [open, updateOperation?.operationId, updateProviderSelection?.provider?.id, expectedUpdateVersion]);
			(0, react.useEffect)(() => {
				if (!open || presentation === "panel") return void 0;
				const opener = document.activeElement;
				closeRef.current?.focus?.();
				const onKeyDown = (event) => {
					if (event.key !== "Escape") return;
					event.preventDefault();
					event.stopPropagation();
					closeView();
				};
				// Capture at window before the underlying Settings dialog receives
				// Escape on document; only the topmost connector dialog should close.
				window.addEventListener("keydown", onKeyDown, true);
				return () => {
					window.removeEventListener("keydown", onKeyDown, true);
					if (opener?.isConnected !== false) opener?.focus?.();
				};
			}, [open, actions, closePanel, presentation]);
			if (!open) return null;
			const updateRunning = updateStarting || updateOperation !== null && ["queued", "running"].includes(updateOperation.state);
			const startUpdate = (force = false) => {
				const provider = updateProviderSelection?.provider;
				const capabilities = updateProviderSelection?.capabilities;
				if (updateRunning || provider === void 0 || capabilities === void 0) return;
				setUpdateError(null);
				setUpdateStarting(true);
				setExpectedUpdateVersion(providerUpdateCheck?.latestVersion ?? versionStatus?.latestVersion ?? null);
				provider.start(capabilities, PLUGIN_PACKAGE_NAME, force).then((operation) => {
					setUpdateStarting(false);
					setUpdateOperation(operation);
				}, (error) => {
					console.error("[mcp-connector] update start failed:", error);
					setUpdateStarting(false);
					if (error?.retryable === true) {
						setUpdateOperation({
							state: "failed",
							failure: {
								code: error.code ?? "UPDATE_FAILED",
								message: error instanceof Error ? error.message : String(error),
								retryable: true
							},
							outcome: { rollback: { available: false, state: "unavailable" } }
						});
					} else {
						setUpdateError(error instanceof Error ? error.message : String(error));
					}
				});
			};
			const rollbackUpdate = () => {
				const provider = updateProviderSelection?.provider;
				const capabilities = updateProviderSelection?.capabilities;
				if (rollbackRunning || provider === void 0 || capabilities === void 0
					|| typeof updateOperation?.operationId !== "string") return;
				setUpdateError(null);
				setRollbackRunning(true);
				provider.rollback(capabilities, updateOperation.operationId).then((operation) => {
					setRollbackRunning(false);
					setUpdateOperation(operation);
				}, (error) => {
					console.error("[mcp-connector] rollback failed:", error);
					setRollbackRunning(false);
					setUpdateError(error instanceof Error ? error.message : String(error));
				});
			};
			const restartHost = () => {
				const provider = updateProviderSelection?.provider;
				const capabilities = updateProviderSelection?.capabilities;
				if (restarting || provider === void 0 || capabilities === void 0) return;
				setRestarting(true);
				setUpdateError(null);
				provider.restart(capabilities).catch((error) => {
					console.error("[mcp-connector] restart failed:", error);
					setRestarting(false);
					setUpdateError(error instanceof Error ? error.message : String(error));
				});
			};
			const renderUpdateControls = () => {
				const activationPendingVersion = updateProviderState === "ready"
					? pendingActivationVersion(versionStatus, providerUpdateCheck)
					: null;
				if (!versionStatus?.updateAvailable
					&& !(updateProviderState === "ready" && providerUpdateCheck?.updateAvailable === true)
					&& activationPendingVersion === null
					&& updateOperation === null && updateError === null) return null;
				if (updateRunning) {
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "mcpConnectorUpdateControls",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "mcpConnectorUpdateButton",
								disabled: true,
								children: updateStarting ? "Starting the update…" : updateProgressLabel(updateOperation)
							}),
							updateError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "mcpConnectorUpdateStatus",
								"data-tone": "error",
								title: updateError,
								children: "The progress is temporarily unavailable, retrying"
							})
						]
					});
				}
				if (updateOperation?.state === "failed") {
					const force = ["RELEASE_TOO_FRESH", "VERSION_UNCHANGED"].includes(updateOperation.failure?.code);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "mcpConnectorUpdateControls",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "mcpConnectorUpdateStatus",
								"data-tone": "error",
								title: updateOperation.failure?.message ?? "Update failed",
								children: updateFailureLabel(updateOperation.failure)
							}),
							updateOperation.failure?.retryable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "mcpConnectorUpdateButton",
								onClick: () => startUpdate(force),
								children: updateOperation.failure?.code === "RELEASE_TOO_FRESH" ? "Update now (skip the wait)" : force ? "Force retry" : "Retry update"
							}),
							rollbackRunning && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "mcpConnectorUpdateStatus",
								children: "An unexpected version was detected, rolling back…"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "mcpConnectorUpdateButton mcpConnectorUpdateSecondary",
								onClick: () => openDshPluginMarket(actions),
								children: "See how to update"
							})
						]
					});
				}
				if (["succeeded", "rolled-back"].includes(updateOperation?.state)) {
					const rolledBack = updateOperation.state === "rolled-back";
					const restartRequired = updateOperation.outcome?.restartRequired === true;
					const refreshRequired = updateOperation.outcome?.refreshRequired === true;
					const rollbackFailed = updateOperation.outcome?.rollback?.state === "failed";
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "mcpConnectorUpdateControls",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "mcpConnectorUpdateStatus",
								children: rolledBack
									? updateOperation.integrityFailure === void 0 ? "Rolled back" : "Blocked the unexpected version and rolled back"
									 : `Installed v${updateOperation.installedVersion ?? versionStatus?.latestVersion}`
							}),
							rollbackFailed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "mcpConnectorUpdateStatus",
								"data-tone": "error",
								title: updateOperation.outcome.rollback.detail ?? "Rollback failed",
								children: "Rollback failed"
							}),
						restartRequired && updateProviderSelection?.capabilities?.restart?.supported === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "mcpConnectorUpdateButton",
								disabled: restarting,
								onClick: restartHost,
								children: restarting ? "Restarting…" : "Restart now"
							}),
						restartRequired && updateProviderSelection?.capabilities?.restart?.supported !== true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "mcpConnectorUpdateStatus",
							title: `Restart is managed by ${updateProviderSelection?.capabilities?.restart?.managedBy ?? "the host"}`,
							children: updateProviderSelection?.capabilities?.runtime === "desktop" ? "Please restart DSH Desktop" : "Please restart DSH"
							}),
							!restartRequired && refreshRequired && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "mcpConnectorUpdateButton",
								onClick: () => window.location.reload(),
								children: "Refresh to apply"
							}),
							updateOperation.outcome?.rollback?.available === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "mcpConnectorUpdateButton mcpConnectorUpdateSecondary",
								disabled: rollbackRunning,
								onClick: rollbackUpdate,
								children: rollbackRunning ? "Rolling back…" : rollbackFailed ? "Retry rollback" : "Roll back"
							})
						]
					});
				}
				if (updateError !== null) {
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "mcpConnectorUpdateControls",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "mcpConnectorUpdateStatus",
								"data-tone": "error",
								title: updateError,
								children: "The update service call failed"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "mcpConnectorUpdateButton mcpConnectorUpdateSecondary",
								onClick: () => openDshPluginMarket(actions),
								children: "See how to update"
							})
						]
					});
				}
				if (updateProviderState === "checking") {
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "mcpConnectorUpdateButton",
						disabled: true,
						children: "Preparing the update…"
					});
				}
				if (updateProviderState === "ready" && providerUpdateCheck?.updateAvailable === true) {
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "mcpConnectorUpdateButton",
						title: `Safely update to v${providerUpdateCheck.latestVersion} with ${updateProviderSelection?.provider?.label ?? "the update service"}`,
						onClick: () => startUpdate(false),
						children: `Update in one click to v${providerUpdateCheck.latestVersion}`
					});
				}
				if (activationPendingVersion !== null) {
					const canRestart = updateProviderSelection?.capabilities?.restart?.supported === true;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "mcpConnectorUpdateControls",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "mcpConnectorUpdateStatus",
								children: `v${activationPendingVersion} is installed and takes effect after a restart`
							}),
							canRestart
								? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "mcpConnectorUpdateButton",
									disabled: restarting,
									onClick: restartHost,
									children: restarting ? "Restarting…" : "Restart now"
								})
								: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "mcpConnectorUpdateStatus",
									title: `Restart is managed by ${updateProviderSelection?.capabilities?.restart?.managedBy ?? "the host"}`,
									children: updateProviderSelection?.capabilities?.runtime === "desktop"
										? "Please restart DSH Desktop"
										: "Please restart DSH"
								})
						]
					});
				}
				const command = manualUpgradeCommand(versionStatus?.latestVersion);
				if (command !== null) {
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "mcpConnectorManualUpdate",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
								className: "mcpConnectorManualCommand",
								title: command,
								children: command
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "mcpConnectorUpdateButton",
								onClick: () => {
									copyManualUpgradeCommand(command).then((copied) => {
										if (copied) setManualCommandCopied(true);
									}, (error) => {
										console.warn("[mcp-connector] copy upgrade command failed:", error);
										window.prompt?.("Copy the upgrade command below", command);
									});
								},
								children: manualCommandCopied ? "Copied" : "Copy upgrade command"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "mcpConnectorUpdateButton mcpConnectorUpdateSecondary",
								onClick: () => window.open(NPM_PACKAGE_URL, "_blank", "noopener,noreferrer"),
								children: "View on npm"
							})
						]
					});
				}
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "mcpConnectorUpdateButton",
					onClick: () => openDshPluginMarket(actions),
					children: "See how to update"
				});
			};
			const src = window.location.origin + "/mcp-connector/ui/";
			const titleId = presentation === "panel"
				? "mcp-connector-native-title"
				: "mcp-connector-modal-title";
			const marketPanel = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "mcpConnectorMarketPanel",
						role: presentation === "panel" ? "region" : "dialog",
						"aria-modal": presentation === "panel" ? void 0 : true,
						"aria-labelledby": titleId,
						style: {
							borderRadius: presentation === "panel" ? 0 : 16,
							width: presentation === "panel" ? "100%" : "min(800px, 90%)",
							height: presentation === "panel" ? "100%" : "min(800px, 85%)",
							display: "flex",
							flexDirection: "column",
							boxShadow: presentation === "panel" ? "none" : "0 20px 60px rgba(0,0,0,0.15)",
							overflow: "hidden"
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "mcpConnectorMarketHeader",
								style: {
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									padding: "20px 24px",
									borderBottom: "1px solid",
									flexShrink: 0,
									filter: detailOpen ? "brightness(0.5)" : "none",
									pointerEvents: detailOpen ? "none" : "auto",
									transition: "filter 0.2s ease"
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0, flex: 1 },
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "mcpConnectorMarketIcon",
												"aria-hidden": true,
												children: (0, react_jsx_runtime.jsxs)("svg", {
													viewBox: "0 0 16 16",
													fill: "none",
													"aria-hidden": "true",
													children: [
														(0, react_jsx_runtime.jsx)("path", { d: "M6 2V4.5", stroke: "currentColor", strokeLinecap: "round" }),
														(0, react_jsx_runtime.jsx)("path", { d: "M10 2V4.5", stroke: "currentColor", strokeLinecap: "round" }),
														(0, react_jsx_runtime.jsx)("path", { d: "M3.5 4.5H12.5V8.25C12.5 10.7353 10.4853 12.75 8 12.75C5.51472 12.75 3.5 10.7353 3.5 8.25V4.5Z", stroke: "currentColor", strokeLinejoin: "round" }),
														(0, react_jsx_runtime.jsx)("path", { d: "M8 12.75V14.5", stroke: "currentColor", strokeLinecap: "round" })
													]
												})
											}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { id: titleId, className: "mcpConnectorMarketTitle", style: { fontSize: 18, fontWeight: 600 }, children: "MCP Connector" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "mcpConnectorVersion",
												title: versionStatus === null ? "Checking the plugin version" : `Current version v${versionStatus.installedVersion}`,
												children: versionStatus === null ? "v…" : `v${versionStatus.installedVersion}`
											}),
											renderUpdateControls(),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "mcpConnectorUpdateButton",
												disabled: versionCheckBusy || updateRunning,
												title: versionStatus?.checkedAt ? `Last checked: ${new Date(versionStatus.checkedAt).toLocaleString()}` : "The version check has not completed yet",
												onClick: () => setVersionCheckRequest((value) => value + 1),
												children: versionCheckBusy ? "Checking for updates…" : "Check for updates"
											}),
											versionCheckFailed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "mcpConnectorUpdateStatus",
												"data-tone": "error",
												children: "The latest npm version cannot be confirmed right now. Please retry"
											}),
											versionStatus?.releasePending && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "mcpConnectorVersion",
												title: "The GitHub release is published; the update becomes available once npm syncs it",
												children: `v${versionStatus.release.version} is syncing`
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										ref: closeRef,
										className: "mcpConnectorMarketClose",
										type: "button",
										"aria-label": presentation === "panel" ? "Back to session" : "Close MCP Connector",
										onClick: closeView,
										style: {
											background: "transparent",
											border: "none",
											fontSize: 22,
											cursor: "pointer",
											padding: "4px 8px",
											borderRadius: 6,
											lineHeight: 1
										},
										children: "\u00D7"
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("iframe", {
								ref: frameRef,
								src,
								onLoad: () => frameRef.current?.contentWindow?.postMessage({
									type: WORKSPACE_CONTEXT_RESULT_TYPE,
									workspace: workspaceContext()
								}, window.location.origin),
								title: "MCP Connector",
								style: {
									flex: 1,
									width: "100%",
									border: "none",
									background: "transparent",
									colorScheme: "light dark"
								}
							})
						]
					});
			if (presentation === "panel") return marketPanel;
			const modal = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					position: "fixed",
					inset: 0,
					background: "rgba(0,0,0,0.4)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					zIndex: CONNECTOR_MODAL_Z_INDEX
				},
				onClick: (event) => { if (event.target === event.currentTarget) closeView(); },
				children: marketPanel
			});
			// shell.overlay lives inside a z-index:20 stacking context, while DSH
			// Settings is a root-level z-index:1000 modal. Portal to body so the
			// quick-open action can reliably place this dialog above Settings.
			if (document.body !== null && document.body !== void 0
				&& typeof react_dom.createPortal === "function") {
				return react_dom.createPortal(modal, document.body);
			}
			return modal;
		}

		/** DSH 0.1.x compatibility entry: mounted only when the native panel slots are incomplete. */
		function LegacySidebarEntry(props) {
			const { wide, useStore, actions } = props;
			const open = useStore((state) => state.open);
			const visible = useStore((state) => state.sidebarVisible !== false);
			const [topMount, setTopMount] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (!visible) {
					setTopMount(null);
					return void 0;
				}
				const removeStyles = installSidebarStyles();
				let disposed = false;
				const ownedMounts = new Set();
				const syncMount = () => {
					if (disposed) return;
					const mount = ensureTopLauncherMount();
					if (mount !== null) ownedMounts.add(mount);
					setTopMount((current) => current === mount ? current : mount);
				};
				syncMount();
				let observer = null;
				if (typeof window.MutationObserver === "function" && document.body !== null) {
					observer = new window.MutationObserver(syncMount);
					observer.observe(document.body, { childList: true, subtree: true });
				}
				return () => {
					disposed = true;
					observer?.disconnect();
					for (const mount of ownedMounts) mount.remove();
					removeStyles();
				};
			}, [visible]);
			if (!visible) return null;
			const launcher = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "mcpConnectorLauncher",
				"data-wide": wide,
				"data-placement": topMount === null ? "footer" : "top",
				"aria-label": "MCP Connector",
				"aria-haspopup": "dialog",
				"aria-expanded": open,
				onClick: () => { try { actions.open(); } catch (error) { console.error('[mcp-connector] open failed:', error); } },
				children: [
					(0, react_jsx_runtime.jsx)("span", {
						className: "mcpConnectorLauncherIcon",
						"aria-hidden": true,
						children: (0, react_jsx_runtime.jsxs)("svg", {
							viewBox: "0 0 16 16",
							fill: "none",
							"aria-hidden": "true",
							children: [
								(0, react_jsx_runtime.jsx)("path", { d: "M6 2V4.5", stroke: "currentColor", strokeLinecap: "round" }),
								(0, react_jsx_runtime.jsx)("path", { d: "M10 2V4.5", stroke: "currentColor", strokeLinecap: "round" }),
								(0, react_jsx_runtime.jsx)("path", { d: "M3.5 4.5H12.5V8.25C12.5 10.7353 10.4853 12.75 8 12.75C5.51472 12.75 3.5 10.7353 3.5 8.25V4.5Z", stroke: "currentColor", strokeLinejoin: "round" }),
								(0, react_jsx_runtime.jsx)("path", { d: "M8 12.75V14.5", stroke: "currentColor", strokeLinecap: "round" })
							]
						})
					}),
					wide ? (0, react_jsx_runtime.jsx)("span", { className: "mcpConnectorLauncherLabel", children: "MCP Connector" }) : null
				]
			});
			if (topMount === null || typeof react_dom.createPortal !== "function") return launcher;
			return react_dom.createPortal(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "mcpConnectorTopEntry",
				"data-wide": wide,
				children: launcher
			}), topMount);
		}

		/** Newer DSH renders the whole row as a button; the plugin only supplies the glyph that follows size and currentColor. */
		function NativeSidebarIcon(props) {
			const size = Number.isFinite(props?.size) ? props.size : 16;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				viewBox: "0 0 16 16",
				width: size,
				height: size,
				fill: "none",
				stroke: "currentColor",
				"aria-hidden": "true",
				style: { display: "block" },
				children: [
					(0, react_jsx_runtime.jsx)("path", { d: "M6 2V4.5", strokeLinecap: "round" }),
					(0, react_jsx_runtime.jsx)("path", { d: "M10 2V4.5", strokeLinecap: "round" }),
					(0, react_jsx_runtime.jsx)("path", { d: "M3.5 4.5H12.5V8.25C12.5 10.7353 10.4853 12.75 8 12.75C5.51472 12.75 3.5 10.7353 3.5 8.25V4.5Z", strokeLinejoin: "round" }),
					(0, react_jsx_runtime.jsx)("path", { d: "M8 12.75V14.5", strokeLinecap: "round" })
				]
			});
		}

		function marketRuntimeProps(ctx) {
			return {
				startPromptSession: (promptText) => startPromptSession(ctx, promptText),
				workspaceContext: () => currentWorkspaceContext(ctx),
				workspaceOptions: () => availableWorkspaceContexts(ctx)
			};
		}

		/**
		 * The native main + sidebar.panellist slots come first; the DSH 0.1.x footer/Portal
		 * compatibility adapter is enabled only when both slots are not ready at the same time. Slots
		 * may be declared late, so the state never depends on DOM probing.
		 */
		function installSidebarSlots(ctx, marketView) {
			let mainReady = false;
			let panelListReady = false;
			let footerReady = false;
			let nativeEntryDispose = null;
			let fallbackEntryDispose = null;

			const layout = () => typeof ctx.get === "function" ? ctx.get("layout") ?? ctx.layout : ctx.layout;
			const leaveNativePanel = () => {
				const controller = layout();
				try {
					if (controller?.panelInfo?.getSnapshot?.().activePanelId === "mcp-connector") {
						controller.selectPanel(null);
					}
				} catch (error) {
					console.warn("[mcp-connector] failed to leave native panel:", error);
				}
			};
			const disposeNativeEntry = () => {
				if (nativeEntryDispose === null) return;
				leaveNativePanel();
				nativeEntryDispose();
				nativeEntryDispose = null;
			};
			const disposeFallbackEntry = () => {
				if (fallbackEntryDispose === null) return;
				fallbackEntryDispose();
				fallbackEntryDispose = null;
			};
			const syncEntries = () => {
				const visible = marketView.getSidebarVisible();
				const nativeReady = mainReady && panelListReady;
				if (nativeReady) {
					disposeFallbackEntry();
					if (visible && nativeEntryDispose === null) {
						nativeEntryDispose = ctx.slots.register({
							name: "sidebar.panellist",
							id: "mcp-connector",
							order: 40,
							label: "MCP Connector"
						}, NativeSidebarIcon);
					} else if (!visible) {
						disposeNativeEntry();
					}
					return;
				}
				disposeNativeEntry();
				if (footerReady && visible && fallbackEntryDispose === null) {
					fallbackEntryDispose = ctx.slots.register({
						name: "sidebar.footer.action",
						id: "mcp-connector",
						order: 0,
						store: marketView
					}, LegacySidebarEntry);
				} else if (!visible) {
					disposeFallbackEntry();
				}
			};

			ctx.effect(() => {
				const unsubscribe = marketView.subscribeSidebarVisible(syncEntries);
				return () => {
					unsubscribe();
					disposeNativeEntry();
					disposeFallbackEntry();
				};
			}, "mcp-connector: sidebar entry visibility");

			// main must be ready before the panellist row, otherwise the host refuses to select a row without a page.
			ctx.slots.inject("main", () => {
				const disposeMain = ctx.slots.register({
					name: "main",
					key: "mcp-connector",
					store: marketView,
					inject: () => ({
						...marketRuntimeProps(ctx),
						presentation: "panel",
						closePanel: () => layout()?.selectPanel?.(null)
					})
				}, MarketOverlay);
				mainReady = true;
				syncEntries();
				return () => {
					leaveNativePanel();
					mainReady = false;
					syncEntries();
					disposeMain();
				};
			});

			ctx.slots.inject("sidebar.panellist", () => {
				panelListReady = true;
				syncEntries();
				return () => {
					panelListReady = false;
					syncEntries();
				};
			});

			ctx.slots.inject("sidebar.footer.action", () => {
				footerReady = true;
				syncEntries();
				return () => {
					footerReady = false;
					disposeFallbackEntry();
				};
			});
		}

		function apply(ctx) {
			console.log('[mcp-connector] client apply() called');
			try {
				const marketView = createMarketViewStore();
				ctx.effect(() => installOverlayStyles(), "mcp-connector: overlay styles");
				installClientSettings(ctx, marketView);

				// Dialog: registered to shell.overlay (like the community plugin marketplace)
				ctx.slots.inject("shell.overlay", () => {
					console.log('[mcp-connector] registering shell.overlay slot');
					return ctx.slots.register({
						name: "shell.overlay",
						id: "mcp-connector",
						order: 100,
						store: marketView,
						inject: () => marketRuntimeProps(ctx)
					}, MarketOverlay);
				});

				installSidebarSlots(ctx, marketView);
				console.log('[mcp-connector] client apply() completed');
			} catch (error) {
				console.error('[mcp-connector] client apply() failed:', error);
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
