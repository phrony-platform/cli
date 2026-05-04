# @phrony/cli

Command-line tool for Phrony **manifest** workflows and **workspace agents**: validate YAML on disk, list agents and versions (and deploy or retract versions), preview and apply changes against your workspace, and compare local files to what is deployed. Authenticate with **`phrony login`** (interactive), manage profiles with **`phrony profile`**, clear saved OAuth with **`phrony profile logout`** / **`phrony logout`**, or use a **workspace access token** (**`PHRONY_ACCESS_TOKEN`**, for CI); see **Auth** below.

## Install

```bash
pnpm add -g @phrony/cli
```

Or with pnpx (published package):

```bash
pnpx @phrony/cli --help
```

From a checkout of this repository (after `pnpm install` and `pnpm run build`):

```bash
pnpm run cli -- --help
pnpm run cli -- login
pnpm run cli -- lint ./manifests
```

Requires **Node.js 20+**.

## Auth

Manifest and agent commands (`plan`, `apply`, `diff`, `agent`) use **`Authorization: Bearer`** on the gateway’s **internal** routes only.

### Credential sources

| Priority | Source | Notes |
| -------- | ------ | ----- |
| 1 | **`PHRONY_ACCESS_TOKEN`** | Dashboard **workspace access token** (`pwt_…`). When set, OAuth tokens in your profile are **ignored** for that run. You still need **`PHRONY_TENANT_ID`** (or **`--tenant`** / `tenantId` in **`phrony.config.json`**). |
| 2 | **`~/.phrony/credentials`** | OAuth tokens from **`phrony login`**. Use **`--profile <name>`**. Override path with **`PHRONY_CREDENTIALS_FILE`**. |

### Workspace access token scopes

Create tokens under **Settings → Access tokens** in the Phrony dashboard.

| Scope | Commands |
| ----- | -------- |
| **`agents:write`** | **`plan`**, **`apply`**, **`agent version deploy`**, **`agent version retract`** |
| **`agents:read`** | **`diff`** (export), **`agent ls`**, **`agent get`**, **`agent version ls`**, **`agent version get`** |

Broader scopes (for example **`internal:*`**) also work if your organization issues them.

### API keys (not used by these commands)

| Kind | Used for |
| ---- | -------- |
| **`PHRONY_API_KEY`**, profile **`api_key`** | Public **`/v1`** with **`X-API-Key`** (use the TypeScript SDK). |

The CLI **does not** use API keys for `plan`, `apply`, `diff`, or `agent`. If either is set, it prints a warning and still requires **`PHRONY_ACCESS_TOKEN`** or **`phrony login`**.

### OAuth login behavior

**`phrony login`** opens your browser; the CLI receives a callback and saves tokens under the selected profile in **`~/.phrony/credentials`**. Use **`--api-base`** for a custom gateway origin (same idea as **`PHRONY_API_BASE`** / **`apiBase`** in config).

**Self-hosted:** the Phrony **API** and **dashboard** URLs must match your deployment; see your organization’s runbook if sign-in fails.

### Tenant and API host

| Setting | Role |
| ------- | ---- |
| **`PHRONY_TENANT_ID`**, **`--tenant`**, **`tenantId` in config** | Workspace for internal API calls. After **`phrony login`**, the signed-in tenant is stored on the profile unless overridden. |
| **`PHRONY_API_BASE`**, **`apiBase` in config** | Gateway origin (default **`https://api.phrony.com`**). |
| **`PHRONY_ROOT_AGENT_ID`**, **`rootAgentId` in config**, **`--agent` on `diff`** | Root agent for manifest **export** only (**subtree**, not the whole workspace). |

## Commands

Full reference (including flags per subcommand): [Phrony docs — CLI](https://docs.phrony.com/packages/cli).

### Global flags (all commands)

These apply to **every** command and subcommand:

| Flag | Description |
| ---- | ----------- |
| `--cwd <dir>` | Working directory (default: current directory). |
| `--profile <name>` | Credentials profile (`~/.phrony/credentials`). |
| `--debug` | Extra diagnostics on **stderr** (secrets redacted). |
| `--json` | Machine-readable JSON on **stdout** where supported. |

### Init

| Command | Description |
| ------- | ----------- |
| `phrony init` | Create `manifests/`, `phrony.config.json`, `phrony.config.ts`, and append `.gitignore` hints for `.env` / `.phrony/`. Refuses to overwrite existing starter files unless **`--force`**. |

### Lint

| Command | Description |
| ------- | ----------- |
| `phrony lint [path]` | Default `./manifests`. Walks `*.yaml` / `*.yml`, resolves `phrony.manifest.index` includes from disk, and validates manifests. Errors use `path:line:column` when possible. **Offline** (no API). |

### Login

| Command | Description |
| ------- | ----------- |
| `phrony login` | Sign in in the browser and save tokens to **`~/.phrony/credentials`** for **`--profile`**. Optional **`--api-base`**. |

### Profile and logout

| Command | Description |
| ------- | ----------- |
| `phrony profile ls` | List credential profiles (OAuth / stored **access token** flags only; no secrets). |
| `phrony profile logout` | Remove saved **OAuth** tokens for **`--profile`** (same as **`phrony logout`**). |
| `phrony logout` | Same as **`phrony profile logout`**. |

### Manifest (`plan`, `apply`, `diff`)

| Command | Description |
| ------- | ----------- |
| `phrony plan [path]` | Dry-run manifest apply (preview only). Optional **`--tenant`**, **`--prune`**, **`--name-suffix`**, **`--anchor-agent`**. |
| `phrony apply [path]` | Dry-run, then interactive confirm (unless **`--auto-approve`**), then apply. Same flags as **`plan`** plus **`--auto-approve`**. With **`--json`**, mutating apply requires **`--auto-approve`**. |
| `phrony diff [path]` | Read-only comparison of local files to the exported manifest subtree for **`--agent`**. Uses **local only** / **remote only** / **changed** — not apply semantics. Optional **`--tenant`**, **`--agent`**. |

`plan`, `apply`, and `diff` accept a **file** or a **directory** that contains `index.yaml` / `index.yml`. Default path: `./manifests`.

### Agent

| Command | Description |
| ------- | ----------- |
| `phrony agent ls` | List agents (table by default; **`--json`** for **`{ total, items }`**). Optional **`--tenant`**, **`--skip`**, **`--take`** (server caps **`take`** at 100). |
| `phrony agent get <agentId>` | Print one agent as JSON. **`--json`** adds a **`{ command, ok, agent }`** wrapper. Optional **`--tenant`**. |

### Agent versions

| Command | Description |
| ------- | ----------- |
| `phrony agent version ls <agentId>` | List versions (newest first; table or **`--json`**). Optional **`--tenant`**, **`--skip`**, **`--take`**. |
| `phrony agent version get <agentId> <versionId>` | Print one version as JSON (same **`--json`** pattern as **`agent get`**). Optional **`--tenant`**. |
| `phrony agent version deploy <agentId> <versionId>` | Deploy a version (**`agents:write`**). Optional **`--tenant`**. |
| `phrony agent version retract <agentId> <versionId>` | Retract a deployed version (**`agents:write`**). Optional **`--tenant`**. |

### CLI version

| Command | Description |
| ------- | ----------- |
| `phrony version` | Print package version (`npm_package_version`), or JSON with **`--json`**. |

## Limitations

| Topic | Detail |
| ----- | ------ |
| Network commands | **`plan`**, **`apply`**, **`diff`**, and **`agent`** need **`phrony login`** or **`PHRONY_ACCESS_TOKEN`** against your workspace API (internal Bearer routes). |
| Export scope | **`diff`** compares one **manifest subtree** rooted at a single agent id, not the entire workspace. |
| Config file | Only **`phrony.config.json`** is read (not **`phrony.config.ts`**). Malformed JSON errors include the file path. |

## Links

| Resource | Link |
| -------- | ---- |
| Phrony docs — CLI | [docs.phrony.com/packages/cli](https://docs.phrony.com/packages/cli) |
| Manifest concept | [docs.phrony.com/concepts/manifest](https://docs.phrony.com/concepts/manifest) |
| TypeScript SDK | [`@phrony/sdk` on npm](https://www.npmjs.com/package/@phrony/sdk) |
