import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { postCliOAuthRefresh } from "./cli-oauth-api.js";
import {
  defaultCredentialsPath,
  loadProfileFromCredentialsFile,
  loadProfileOAuthFromCredentialsFile,
  persistProfileOAuthCredentials,
  resolveDefaultProfileName,
} from "./credentials.js";

export type PhronyCliConfigJson = {
  tenantId?: string;
  apiBase?: string;
  rootAgentId?: string;
  defaultProfile?: string;
};

const DEFAULT_API_BASE = "https://api.phrony.com";

const OAUTH_REFRESH_SKEW_MS = 60_000;

export function loadPhronyCliConfig(cwd: string): PhronyCliConfigJson | null {
  const p = path.join(cwd, "phrony.config.json");
  if (!existsSync(p)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(p, "utf8")) as PhronyCliConfigJson;
  } catch {
    return null;
  }
}

export type ResolvedCliAuthOAuth = {
  mode: "oauth";
  accessToken: string;
  refreshToken: string;
  accessExpiresAtMs: number;
  apiBase: string;
  tenantId: string;
  rootAgentId?: string;
  profile: string;
};

/** Dashboard-issued workspace access token (`pwt_…`), Bearer on internal gateway routes. */
export type ResolvedCliAuthAccessToken = {
  mode: "access_token";
  accessToken: string;
  apiBase: string;
  tenantId: string;
  rootAgentId?: string;
  profile: string;
};

export type ResolvedCliAuth = ResolvedCliAuthOAuth | ResolvedCliAuthAccessToken;

export type ResolveAuthOptions = {
  cwd: string;
  profile?: string;
  /** Explicit tenant (CLI flag) overrides env + config + stored OAuth tenant */
  tenantId?: string;
  rootAgentId?: string;
  fetchImpl?: typeof fetch;
};

function normalizeApiBase(raw: string): string {
  return raw.replace(/\/+$/, "");
}

async function refreshOAuthIfStale(
  credPath: string,
  profile: string,
  oauth: NonNullable<ReturnType<typeof loadProfileOAuthFromCredentialsFile>>,
  apiBase: string,
  fetchImpl: typeof fetch,
): Promise<{
  accessToken: string;
  refreshToken: string;
  accessExpiresAtMs: number;
  tenantId: string;
}> {
  if (Date.now() < oauth.accessExpiresAtMs - OAUTH_REFRESH_SKEW_MS) {
    return {
      accessToken: oauth.accessToken,
      refreshToken: oauth.refreshToken,
      accessExpiresAtMs: oauth.accessExpiresAtMs,
      tenantId: oauth.tenantId,
    };
  }
  const refreshed = await postCliOAuthRefresh(apiBase, oauth.refreshToken, fetchImpl);
  const accessExpiresAtMs = Date.now() + refreshed.tokens.accessExpiresIn * 1000;
  persistProfileOAuthCredentials(credPath, profile, {
    accessToken: refreshed.tokens.accessToken,
    refreshToken: refreshed.tokens.refreshToken,
    accessExpiresAtMs,
    tenantId: refreshed.tenant.id,
    apiBase,
    userEmail: refreshed.user.email,
  });
  return {
    accessToken: refreshed.tokens.accessToken,
    refreshToken: refreshed.tokens.refreshToken,
    accessExpiresAtMs,
    tenantId: refreshed.tenant.id,
  };
}

/**
 * Resolve workspace access token or OAuth profile credentials for network commands.
 * Order: **`PHRONY_ACCESS_TOKEN`** → **OAuth** profile from **`phrony login`** (with refresh).
 * For OAuth, the gateway URL is **`PHRONY_API_BASE`**, then **`api_base` saved on that profile**, then **`apiBase` in `phrony.config.json`**, so a project template pointing at production does not override a local-dev login.
 *
 * Workspace **API keys** (`PHRONY_API_KEY`, profile `api_key`) are not used for manifest or agent commands;
 * they target external `/v1` routes. Use **`PHRONY_ACCESS_TOKEN`** or **`phrony login`** instead.
 */
export async function resolveCliAuth(opts: ResolveAuthOptions): Promise<ResolvedCliAuth> {
  const cfg = loadPhronyCliConfig(opts.cwd);
  const credPath = defaultCredentialsPath();
  const profile =
    opts.profile ?? cfg?.defaultProfile ?? resolveDefaultProfileName(credPath) ?? "default";

  const pat = process.env.PHRONY_ACCESS_TOKEN?.trim();
  if (pat) {
    console.warn(
      `[phrony] PHRONY_ACCESS_TOKEN is set — API requests use that bearer token; profile "${profile}" does not select a different token (OAuth in ~/.phrony/credentials is not used).`,
    );
    const apiBaseRaw =
      process.env.PHRONY_API_BASE?.trim() || cfg?.apiBase?.trim() || DEFAULT_API_BASE;
    const apiBase = normalizeApiBase(apiBaseRaw);
    const tenantId =
      opts.tenantId?.trim() ||
      process.env.PHRONY_TENANT_ID?.trim() ||
      cfg?.tenantId?.trim();
    if (!tenantId) {
      throw new Error(
        "Missing tenant id: set PHRONY_TENANT_ID, pass --tenant, or add tenantId to phrony.config.json.",
      );
    }
    const rootAgentId =
      opts.rootAgentId?.trim() ||
      process.env.PHRONY_ROOT_AGENT_ID?.trim() ||
      cfg?.rootAgentId?.trim();
    return { mode: "access_token", accessToken: pat, apiBase, tenantId, rootAgentId, profile };
  }

  const ignoredApiKey =
    process.env.PHRONY_API_KEY?.trim() || loadProfileFromCredentialsFile(credPath, profile)?.apiKey;
  if (ignoredApiKey) {
    console.warn(
      `[phrony] PHRONY_API_KEY and profile api_key are not used for plan, apply, diff, or agent. Use PHRONY_ACCESS_TOKEN (dashboard) or phrony login (OAuth).`,
    );
  }

  const oauth = loadProfileOAuthFromCredentialsFile(credPath, profile);
  if (!oauth) {
    throw new Error(
      "Missing credentials: set PHRONY_ACCESS_TOKEN for CI, or run `phrony login` for this profile.",
    );
  }

  const apiBaseRaw =
    process.env.PHRONY_API_BASE?.trim() ||
    oauth.apiBase?.trim() ||
    cfg?.apiBase?.trim() ||
    DEFAULT_API_BASE;
  const apiBase = normalizeApiBase(apiBaseRaw);

  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const fresh = await refreshOAuthIfStale(credPath, profile, oauth, apiBase, fetchImpl);

  const tenantId =
    opts.tenantId?.trim() ||
    process.env.PHRONY_TENANT_ID?.trim() ||
    fresh.tenantId ||
    cfg?.tenantId?.trim();
  if (!tenantId) {
    throw new Error(
      "Missing tenant id: pass --tenant, set PHRONY_TENANT_ID, add tenantId to phrony.config.json, or re-run `phrony login`.",
    );
  }

  const rootAgentId =
    opts.rootAgentId?.trim() ||
    process.env.PHRONY_ROOT_AGENT_ID?.trim() ||
    cfg?.rootAgentId?.trim();

  return {
    mode: "oauth",
    accessToken: fresh.accessToken,
    refreshToken: fresh.refreshToken,
    accessExpiresAtMs: fresh.accessExpiresAtMs,
    apiBase,
    tenantId,
    rootAgentId,
    profile,
  };
}
