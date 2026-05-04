import type { DebugLogger } from "../lib/debug-logger.js";
import {
  defaultCredentialsPath,
  removeProfileOAuthCredentials,
  resolveDefaultProfileName,
} from "../lib/credentials.js";
import { loadPhronyCliConfig } from "../lib/resolve-cli-auth.js";

export type LogoutOptions = {
  cwd: string;
  profile?: string;
  json: boolean;
  debug: DebugLogger;
  /** `command` field in JSON output (e.g. `profile logout`). */
  jsonCommand?: string;
};

export function runLogout(opts: LogoutOptions): { ok: boolean; exitCode: number } {
  try {
    const cfg = loadPhronyCliConfig(opts.cwd);
    const credPath = defaultCredentialsPath();
    const profile =
      opts.profile ?? cfg?.defaultProfile ?? resolveDefaultProfileName(credPath) ?? "default";

    const jsonCmd = opts.jsonCommand ?? "logout";
    opts.debug(`logout: profile=${profile} path=${credPath} jsonCommand=${jsonCmd}`);

    const result = removeProfileOAuthCredentials(credPath, profile);

    if (opts.json) {
      if (result.missingFile) {
        console.log(
          JSON.stringify({
            command: jsonCmd,
            ok: true,
            profile,
            removed: false,
            reason: "missing_credentials_file",
          }),
        );
        return { ok: true, exitCode: 0 };
      }
      if (result.noProfileTable) {
        console.log(
          JSON.stringify({
            command: jsonCmd,
            ok: true,
            profile,
            removed: false,
            reason: "no_profile",
          }),
        );
        return { ok: true, exitCode: 0 };
      }
      if (!result.hadOAuthSession) {
        console.log(
          JSON.stringify({
            command: jsonCmd,
            ok: true,
            profile,
            removed: false,
            reason: "no_oauth_session",
          }),
        );
        return { ok: true, exitCode: 0 };
      }
      console.log(
        JSON.stringify({
          command: jsonCmd,
          ok: true,
          profile,
          removed: true,
          removedProfile: result.removedProfile,
          path: credPath,
        }),
      );
      return { ok: true, exitCode: 0 };
    }

    if (result.missingFile) {
      console.log(`No credentials file at ${credPath} (nothing to clear).`);
      return { ok: true, exitCode: 0 };
    }
    if (result.noProfileTable) {
      console.log(`Profile "${profile}" is not defined in ${credPath}.`);
      return { ok: true, exitCode: 0 };
    }
    if (!result.hadOAuthSession) {
      console.log(`Profile "${profile}" has no saved OAuth session in ${credPath}.`);
      return { ok: true, exitCode: 0 };
    }

    console.log(
      result.removedProfile
        ? `Removed profile "${profile}" and OAuth tokens from ${credPath}.`
        : `Cleared OAuth tokens for profile "${profile}" in ${credPath}.`,
    );
    return { ok: true, exitCode: 0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (opts.json) {
      console.log(
        JSON.stringify({ command: opts.jsonCommand ?? "logout", ok: false, error: "error", message: msg }),
      );
    } else {
      console.error(msg);
    }
    return { ok: false, exitCode: 1 };
  }
}
