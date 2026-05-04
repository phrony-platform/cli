import type { DebugLogger } from "../lib/debug-logger.js";
import { InternalAgentsGatewayClient } from "../lib/internal-agents-client.js";
import { ManifestHttpError } from "../lib/manifest-client.js";
import { renderAgentListTable } from "../lib/render-agent-list.js";
import { resolveCliAuth } from "../lib/resolve-cli-auth.js";

export type AgentLsOptions = {
  cwd: string;
  json: boolean;
  profile?: string;
  tenantId?: string;
  skip?: number;
  take?: number;
  debug: DebugLogger;
};

export type AgentGetOptions = {
  cwd: string;
  json: boolean;
  profile?: string;
  tenantId?: string;
  agentId: string;
  debug: DebugLogger;
};

function isAgentListPayload(v: unknown): v is { total: number; items: unknown[] } {
  if (typeof v !== "object" || v === null) {
    return false;
  }
  const o = v as Record<string, unknown>;
  return typeof o.total === "number" && Array.isArray(o.items);
}

export async function runAgentLs(opts: AgentLsOptions): Promise<{ ok: boolean; exitCode: number }> {
  try {
    const auth = await resolveCliAuth({
      cwd: opts.cwd,
      profile: opts.profile,
      tenantId: opts.tenantId,
    });
    opts.debug(`agent ls: tenant=${auth.tenantId} profile=${auth.profile} mode=${auth.mode}`);
    const client = new InternalAgentsGatewayClient({
      accessToken: auth.accessToken,
      apiBase: auth.apiBase,
      tenantId: auth.tenantId,
    });
    const hasPaging = opts.skip !== undefined || opts.take !== undefined;
    const data = await client.listAgents(
      hasPaging
        ? {
            ...(opts.skip !== undefined ? { skip: opts.skip } : {}),
            ...(opts.take !== undefined ? { take: opts.take } : {}),
          }
        : undefined,
    );
    if (!isAgentListPayload(data)) {
      throw new Error("Unexpected list response shape from API.");
    }
    if (opts.json) {
      console.log(JSON.stringify({ command: "agent ls", ok: true, ...data }, null, 2));
    } else {
      console.log(renderAgentListTable(data.total, data.items));
    }
    return { ok: true, exitCode: 0 };
  } catch (e) {
    if (e instanceof ManifestHttpError) {
      if (opts.json) {
        console.log(
          JSON.stringify({
            command: "agent ls",
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
      console.log(JSON.stringify({ command: "agent ls", ok: false, error: "error", message: msg }));
    } else {
      console.error(msg);
    }
    return { ok: false, exitCode: 1 };
  }
}

export async function runAgentGet(opts: AgentGetOptions): Promise<{ ok: boolean; exitCode: number }> {
  try {
    const auth = await resolveCliAuth({
      cwd: opts.cwd,
      profile: opts.profile,
      tenantId: opts.tenantId,
    });
    opts.debug(`agent get: tenant=${auth.tenantId} agent=${opts.agentId} profile=${auth.profile}`);
    const client = new InternalAgentsGatewayClient({
      accessToken: auth.accessToken,
      apiBase: auth.apiBase,
      tenantId: auth.tenantId,
    });
    const data = await client.getAgent(opts.agentId);
    if (opts.json) {
      console.log(JSON.stringify({ command: "agent get", ok: true, agent: data }, null, 2));
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
    return { ok: true, exitCode: 0 };
  } catch (e) {
    if (e instanceof ManifestHttpError) {
      if (opts.json) {
        console.log(
          JSON.stringify({
            command: "agent get",
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
      console.log(JSON.stringify({ command: "agent get", ok: false, error: "error", message: msg }));
    } else {
      console.error(msg);
    }
    return { ok: false, exitCode: 1 };
  }
}
