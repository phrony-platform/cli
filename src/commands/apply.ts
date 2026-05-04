import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
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

export type ApplyOptions = {
  cwd: string;
  manifestPath: string;
  json: boolean;
  profile?: string;
  tenantId?: string;
  prune: boolean;
  nameSuffix?: string;
  anchorAgentId?: string;
  autoApprove: boolean;
  debug: DebugLogger;
};

async function confirmApply(): Promise<boolean> {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = (await rl.question("Apply these changes? [y/N] ")).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

export async function runApply(opts: ApplyOptions): Promise<{ ok: boolean; exitCode: number }> {
  try {
    const auth = await resolveCliAuth({
      cwd: opts.cwd,
      profile: opts.profile,
      tenantId: opts.tenantId,
    });
    opts.debug(`apply: tenant=${auth.tenantId} profile=${auth.profile} mode=${auth.mode}`);
    const client = createManifestClient(manifestClientOptionsFromResolved(auth));
    const entry = resolveManifestEntryFile(opts.cwd, opts.manifestPath);
    const yaml = loadMergedManifestYamlString(entry);

    const planResult = await client.applyManifestYaml(yaml, {
      dryRun: true,
      prune: opts.prune,
      nameSuffix: opts.nameSuffix,
      anchorAgentId: opts.anchorAgentId,
    });
    const planDto = manifestApplyResultToDto(planResult);
    if (opts.json && !opts.autoApprove) {
      console.log(
        JSON.stringify(
          {
            command: "apply",
            ok: true,
            applied: false,
            message:
              "Dry-run only: pass --auto-approve with --json to perform the mutating apply (non-interactive).",
            plan: planDto,
          },
          null,
          2,
        ),
      );
      return { ok: true, exitCode: 0 };
    }
    if (!opts.json) {
      console.log(renderManifestPlanTable(planDto));
    }
    const skipPrompt = opts.autoApprove;
    if (!skipPrompt) {
      const ok = await confirmApply();
      if (!ok) {
        console.error("apply cancelled");
        return { ok: false, exitCode: 1 };
      }
    }

    const applyResult = await client.applyManifestYaml(yaml, {
      dryRun: false,
      prune: opts.prune,
      nameSuffix: opts.nameSuffix,
      anchorAgentId: opts.anchorAgentId,
    });
    const dto = manifestApplyResultToDto(applyResult);
    if (opts.json) {
      console.log(JSON.stringify({ command: "apply", ok: true, plan: planDto, apply: dto }, null, 2));
    } else {
      console.log(renderManifestPlanTable(dto));
    }
    return { ok: true, exitCode: 0 };
  } catch (e) {
    if (e instanceof ManifestApiUnavailableError) {
      if (opts.json) {
        console.log(
          JSON.stringify({
            command: "apply",
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
            command: "apply",
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
      console.log(JSON.stringify({ command: "apply", ok: false, error: "error", message: msg }));
    } else {
      console.error(msg);
    }
    return { ok: false, exitCode: 1 };
  }
}
