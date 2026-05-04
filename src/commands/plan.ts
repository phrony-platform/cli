import type { DebugLogger } from "../lib/debug-logger.js";
import { loadMergedManifestYamlString, resolveManifestEntryFile } from "../lib/manifest-file-loader.js";
import {
  createManifestClient,
  ManifestHttpError,
  manifestClientOptionsFromResolved,
} from "../lib/manifest-client.js";
import { manifestApplyResultToDto } from "../lib/manifest-plan-dto.js";
import { renderManifestPlanTable } from "../lib/render-manifest-plan.js";
import { resolveCliAuth } from "../lib/resolve-cli-auth.js";
import { ManifestApiUnavailableError } from "../api/manifest-api.js";

export type PlanOptions = {
  cwd: string;
  manifestPath: string;
  json: boolean;
  profile?: string;
  tenantId?: string;
  prune: boolean;
  nameSuffix?: string;
  anchorAgentId?: string;
  debug: DebugLogger;
};

export async function runPlan(opts: PlanOptions): Promise<{ ok: boolean; exitCode: number }> {
  try {
    const auth = await resolveCliAuth({
      cwd: opts.cwd,
      profile: opts.profile,
      tenantId: opts.tenantId,
    });
    opts.debug(`plan: tenant=${auth.tenantId} profile=${auth.profile} mode=${auth.mode}`);
    const client = createManifestClient(manifestClientOptionsFromResolved(auth));
    const entry = resolveManifestEntryFile(opts.cwd, opts.manifestPath);
    const yaml = loadMergedManifestYamlString(entry);
    const result = await client.applyManifestYaml(yaml, {
      dryRun: true,
      prune: opts.prune,
      nameSuffix: opts.nameSuffix,
      anchorAgentId: opts.anchorAgentId,
    });
    const dto = manifestApplyResultToDto(result);
    if (opts.json) {
      console.log(JSON.stringify({ command: "plan", ok: true, ...dto }, null, 2));
    } else {
      console.log(renderManifestPlanTable(dto));
    }
    return { ok: true, exitCode: 0 };
  } catch (e) {
    if (e instanceof ManifestApiUnavailableError) {
      if (opts.json) {
        console.log(
          JSON.stringify({
            command: "plan",
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
            command: "plan",
            ok: false,
            error: "http",
            status: e.status,
            message: e.message,
          }),
        );
      } else {
        console.error(e.message);
      }
      return { ok: false, exitCode: 1 };
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (opts.json) {
      console.log(JSON.stringify({ command: "plan", ok: false, error: "error", message: msg }));
    } else {
      console.error(msg);
    }
    return { ok: false, exitCode: 1 };
  }
}
