import type { DebugLogger } from "../lib/debug-logger.js";
import { loadPhronyManifestFromFile, resolveManifestEntryFile } from "../lib/manifest-file-loader.js";
import {
  createManifestClient,
  ManifestHttpError,
  manifestClientOptionsFromResolved,
} from "../lib/manifest-client.js";
import { diffManifestTrees } from "../lib/manifest-structural-diff.js";
import { renderManifestPlanTable } from "../lib/render-manifest-plan.js";
import { formatHttpErrorForTerminal, unauthorizedHttpHint } from "../lib/http-auth-failure-hint.js";
import { resolveCliAuth, type ResolvedCliAuth } from "../lib/resolve-cli-auth.js";
import { parsePhronyManifestYaml } from "../schema/manifest-yaml.js";
import { ManifestApiUnavailableError } from "../api/manifest-api.js";

export type DiffOptions = {
  cwd: string;
  manifestPath: string;
  json: boolean;
  profile?: string;
  tenantId?: string;
  /** Root agent id for export (flag overrides env/config) */
  agentId?: string;
  debug: DebugLogger;
};

export async function runDiff(opts: DiffOptions): Promise<{ ok: boolean; exitCode: number }> {
  let auth: ResolvedCliAuth | undefined;
  try {
    auth = await resolveCliAuth({
      cwd: opts.cwd,
      profile: opts.profile,
      tenantId: opts.tenantId,
      rootAgentId: opts.agentId,
    });
    const agentId = opts.agentId?.trim() || auth.rootAgentId;
    if (!agentId) {
      throw new Error(
        "Missing root agent id for export: set PHRONY_ROOT_AGENT_ID, pass --agent, or add rootAgentId to phrony.config.json.",
      );
    }
    opts.debug(`diff: tenant=${auth.tenantId} agent=${agentId} mode=${auth.mode}`);
    const client = createManifestClient(manifestClientOptionsFromResolved(auth));
    const entry = resolveManifestEntryFile(opts.cwd, opts.manifestPath);
    const local = loadPhronyManifestFromFile(entry);
    const remoteYaml = await client.exportAgentManifestYaml(agentId);
    const remote = parsePhronyManifestYaml(remoteYaml);
    const table = diffManifestTrees(local, remote);
    if (opts.json) {
      console.log(JSON.stringify({ command: "diff", ok: true, ...table }, null, 2));
    } else {
      console.log(renderManifestPlanTable(table));
    }
    return { ok: true, exitCode: 0 };
  } catch (e) {
    if (e instanceof ManifestApiUnavailableError) {
      if (opts.json) {
        console.log(
          JSON.stringify({
            command: "diff",
            ok: false,
            error: "manifest_api_unavailable",
            message: e.message,
          }),
        );
      } else {
        console.error(e.message);
      }
      return { ok: false, exitCode: 2 };
    }
    if (e instanceof ManifestHttpError) {
      if (opts.json) {
        console.log(
          JSON.stringify({
            command: "diff",
            ok: false,
            error: "http",
            status: e.status,
            message: e.message,
            ...(e.status === 401 && auth ? { hint: unauthorizedHttpHint(auth) } : {}),
          }),
        );
      } else {
        console.error(auth ? formatHttpErrorForTerminal(e.status, e.message, auth) : e.message);
      }
      return { ok: false, exitCode: 1 };
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (opts.json) {
      console.log(JSON.stringify({ command: "diff", ok: false, error: "error", message: msg }));
    } else {
      console.error(msg);
    }
    return { ok: false, exitCode: 1 };
  }
}
