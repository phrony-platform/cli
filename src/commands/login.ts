import type { DebugLogger } from "../lib/debug-logger.js";
import {
  defaultCredentialsPath,
  persistProfileOAuthCredentials,
  resolveDefaultProfileName,
} from "../lib/credentials.js";
import { runBrowserOAuthLogin } from "../lib/oauth-login.js";
import { loadPhronyCliConfig } from "../lib/resolve-cli-auth.js";

const DEFAULT_API_BASE = "https://api.phrony.com";

export type LoginOptions = {
  cwd: string;
  profile?: string;
  json: boolean;
  debug: DebugLogger;
  /** Overrides PHRONY_API_BASE / phrony.config.json for this login only */
  apiBase?: string;
};

export async function runLogin(opts: LoginOptions): Promise<{ ok: boolean; exitCode: number }> {
  try {
    const cfg = loadPhronyCliConfig(opts.cwd);
    const credPath = defaultCredentialsPath();
    const profile =
      opts.profile ?? cfg?.defaultProfile ?? resolveDefaultProfileName(credPath) ?? "default";
    const apiBaseRaw =
      opts.apiBase?.trim() ||
      process.env.PHRONY_API_BASE?.trim() ||
      cfg?.apiBase?.trim() ||
      DEFAULT_API_BASE;
    const apiBase = apiBaseRaw.replace(/\/+$/, "");

    opts.debug(`login: apiBase=${apiBase} profile=${profile}`);

    const login = await runBrowserOAuthLogin({ apiBase });

    const accessExpiresAtMs = Date.now() + login.tokens.accessExpiresIn * 1000;
    persistProfileOAuthCredentials(credPath, profile, {
      accessToken: login.tokens.accessToken,
      refreshToken: login.tokens.refreshToken,
      accessExpiresAtMs,
      tenantId: login.tenant.id,
      apiBase,
      userEmail: login.user.email,
    });

    if (opts.json) {
      console.log(
        JSON.stringify({
          command: "login",
          ok: true,
          profile,
          tenantId: login.tenant.id,
          tenantName: login.tenant.name,
          userEmail: login.user.email,
        }),
      );
    } else {
      console.log(`Signed in to profile "${profile}" (${login.user.email}).`);
      console.log(`Workspace ${login.tenant.name} (${login.tenant.id}).`);
      console.log(`Credentials updated: ${credPath}`);
    }
    return { ok: true, exitCode: 0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (opts.json) {
      console.log(JSON.stringify({ command: "login", ok: false, error: "error", message: msg }));
    } else {
      console.error(msg);
    }
    return { ok: false, exitCode: 1 };
  }
}
