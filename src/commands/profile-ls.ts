import Table from "cli-table3";
import pc from "picocolors";
import type { DebugLogger } from "../lib/debug-logger.js";
import {
  defaultCredentialsPath,
  listCredentialsProfiles,
  resolveDefaultProfileName,
} from "../lib/credentials.js";
import { loadPhronyCliConfig } from "../lib/resolve-cli-auth.js";

const TABLE_CHARS = {
  top: "",
  "top-mid": "",
  "top-left": "",
  "top-right": "",
  bottom: "",
  "bottom-mid": "",
  "bottom-left": "",
  "bottom-right": "",
  left: "",
  "left-mid": "",
  mid: "",
  "mid-mid": "",
  right: "",
  "right-mid": "",
  middle: " ",
} as const;

export type ProfileLsOptions = {
  cwd: string;
  profile?: string;
  json: boolean;
  debug: DebugLogger;
};

export function runProfileLs(opts: ProfileLsOptions): { ok: boolean; exitCode: number } {
  try {
    const cfg = loadPhronyCliConfig(opts.cwd);
    const credPath = defaultCredentialsPath();
    const effectiveProfile =
      opts.profile ?? cfg?.defaultProfile ?? resolveDefaultProfileName(credPath) ?? "default";

    opts.debug(`profile ls: path=${credPath} effectiveProfile=${effectiveProfile}`);

    const list = listCredentialsProfiles(credPath);

    if (opts.json) {
      console.log(
        JSON.stringify({
          command: "profile ls",
          ok: true,
          path: credPath,
          credentialsFileDefault: list.fileDefaultProfile ?? null,
          configDefaultProfile: cfg?.defaultProfile ?? null,
          effectiveProfile,
          missingFile: list.missingFile,
          profiles: list.profiles.map((p) => ({
            name: p.name,
            oauth: p.hasOAuthSession,
            accessToken: p.hasAccessToken,
            selected: p.name === effectiveProfile,
          })),
        }),
      );
      return { ok: true, exitCode: 0 };
    }

    if (list.missingFile) {
      console.log(`No credentials file at ${credPath}.`);
      console.log(pc.dim(`Run ${pc.cyan("phrony login")} to create one.`));
      return { ok: true, exitCode: 0 };
    }

    console.log(pc.bold("Credentials profiles"));
    console.log(pc.dim(credPath));
    console.log("");

    if (list.profiles.length === 0) {
      console.log(pc.dim("No profile tables in this file."));
      return { ok: true, exitCode: 0 };
    }

    const table = new Table({
      head: [pc.bold(""), pc.bold("Profile"), pc.bold("OAuth"), pc.bold("Access token")],
      style: { head: [], border: [] },
      chars: TABLE_CHARS,
    });

    for (const p of list.profiles) {
      const sel = p.name === effectiveProfile;
      table.push([
        sel ? pc.cyan("→") : "",
        sel ? pc.cyan(p.name) : p.name,
        p.hasOAuthSession ? pc.green("yes") : pc.dim("no"),
        p.hasAccessToken ? pc.green("yes") : pc.dim("no"),
      ]);
    }

    console.log(table.toString());
    console.log("");
    console.log(
      pc.dim(
        `→ marks the profile other commands use when ${pc.cyan("--profile")} is omitted (${pc.bold(effectiveProfile)}).`,
      ),
    );
    if (list.fileDefaultProfile !== undefined) {
      console.log(pc.dim(`Credentials file default: ${list.fileDefaultProfile}`));
    }
    if (cfg?.defaultProfile !== undefined) {
      console.log(pc.dim(`phrony.config.json defaultProfile: ${cfg.defaultProfile}`));
    }

    return { ok: true, exitCode: 0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (opts.json) {
      console.log(
        JSON.stringify({ command: "profile ls", ok: false, error: "error", message: msg }),
      );
    } else {
      console.error(msg);
    }
    return { ok: false, exitCode: 1 };
  }
}
