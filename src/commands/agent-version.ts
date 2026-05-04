import type { DebugLogger } from "../lib/debug-logger.js";
import { InternalAgentsGatewayClient } from "../lib/internal-agents-client.js";
import { ManifestHttpError } from "../lib/manifest-client.js";
import { renderAgentVersionListTable } from "../lib/render-agent-version-list.js";
import { resolveCliAuth } from "../lib/resolve-cli-auth.js";

export type AgentVersionLsOptions = {
  cwd: string;
  json: boolean;
  profile?: string;
  tenantId?: string;
  agentId: string;
  skip?: number;
  take?: number;
  debug: DebugLogger;
};

export type AgentVersionGetOptions = {
  cwd: string;
  json: boolean;
  profile?: string;
  tenantId?: string;
  agentId: string;
  versionId: string;
  debug: DebugLogger;
};

export type AgentVersionDeployOptions = {
  cwd: string;
  json: boolean;
  profile?: string;
  tenantId?: string;
  agentId: string;
  versionId: string;
  debug: DebugLogger;
};

export type AgentVersionRetractOptions = AgentVersionDeployOptions;

function isVersionListPayload(v: unknown): v is { total: number; items: unknown[] } {
  if (typeof v !== "object" || v === null) {
    return false;
  }
  const o = v as Record<string, unknown>;
  return typeof o.total === "number" && Array.isArray(o.items);
}

function writeHttpErr(command: string, e: ManifestHttpError, json: boolean): void {
  if (json) {
    console.log(
      JSON.stringify({
        command,
        ok: false,
        error: "http",
        status: e.status,
        message: e.message,
      }),
    );
  } else {
    console.error(e.message);
  }
}

function writeGenericErr(command: string, msg: string, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ command, ok: false, error: "error", message: msg }));
  } else {
    console.error(msg);
  }
}

export async function runAgentVersionLs(
  opts: AgentVersionLsOptions,
): Promise<{ ok: boolean; exitCode: number }> {
  const command = "agent version ls";
  try {
    const auth = await resolveCliAuth({
      cwd: opts.cwd,
      profile: opts.profile,
      tenantId: opts.tenantId,
    });
    opts.debug(
      `agent version ls: tenant=${auth.tenantId} agent=${opts.agentId} profile=${auth.profile}`,
    );
    const client = new InternalAgentsGatewayClient({
      accessToken: auth.accessToken,
      apiBase: auth.apiBase,
      tenantId: auth.tenantId,
    });
    const hasPaging = opts.skip !== undefined || opts.take !== undefined;
    const data = await client.listAgentVersions(
      opts.agentId,
      hasPaging
        ? {
            ...(opts.skip !== undefined ? { skip: opts.skip } : {}),
            ...(opts.take !== undefined ? { take: opts.take } : {}),
          }
        : undefined,
    );
    if (!isVersionListPayload(data)) {
      throw new Error("Unexpected list response shape from API.");
    }
    if (opts.json) {
      console.log(JSON.stringify({ command, ok: true, ...data }, null, 2));
    } else {
      console.log(renderAgentVersionListTable(data.total, data.items));
    }
    return { ok: true, exitCode: 0 };
  } catch (e) {
    if (e instanceof ManifestHttpError) {
      writeHttpErr(command, e, opts.json);
      return { ok: false, exitCode: 1 };
    }
    writeGenericErr(command, e instanceof Error ? e.message : String(e), opts.json);
    return { ok: false, exitCode: 1 };
  }
}

export async function runAgentVersionGet(
  opts: AgentVersionGetOptions,
): Promise<{ ok: boolean; exitCode: number }> {
  const command = "agent version get";
  try {
    const auth = await resolveCliAuth({
      cwd: opts.cwd,
      profile: opts.profile,
      tenantId: opts.tenantId,
    });
    opts.debug(
      `agent version get: tenant=${auth.tenantId} agent=${opts.agentId} version=${opts.versionId}`,
    );
    const client = new InternalAgentsGatewayClient({
      accessToken: auth.accessToken,
      apiBase: auth.apiBase,
      tenantId: auth.tenantId,
    });
    const data = await client.getAgentVersion(opts.agentId, opts.versionId);
    if (opts.json) {
      console.log(JSON.stringify({ command, ok: true, version: data }, null, 2));
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
    return { ok: true, exitCode: 0 };
  } catch (e) {
    if (e instanceof ManifestHttpError) {
      writeHttpErr(command, e, opts.json);
      return { ok: false, exitCode: 1 };
    }
    writeGenericErr(command, e instanceof Error ? e.message : String(e), opts.json);
    return { ok: false, exitCode: 1 };
  }
}

export async function runAgentVersionDeploy(
  opts: AgentVersionDeployOptions,
): Promise<{ ok: boolean; exitCode: number }> {
  const command = "agent version deploy";
  try {
    const auth = await resolveCliAuth({
      cwd: opts.cwd,
      profile: opts.profile,
      tenantId: opts.tenantId,
    });
    opts.debug(
      `agent version deploy: tenant=${auth.tenantId} agent=${opts.agentId} version=${opts.versionId}`,
    );
    const client = new InternalAgentsGatewayClient({
      accessToken: auth.accessToken,
      apiBase: auth.apiBase,
      tenantId: auth.tenantId,
    });
    const data = await client.deployAgentVersion(opts.agentId, opts.versionId);
    if (opts.json) {
      console.log(JSON.stringify({ command, ok: true, result: data }, null, 2));
    } else {
      console.log(data === null ? "Deployed." : JSON.stringify(data, null, 2));
    }
    return { ok: true, exitCode: 0 };
  } catch (e) {
    if (e instanceof ManifestHttpError) {
      writeHttpErr(command, e, opts.json);
      return { ok: false, exitCode: 1 };
    }
    writeGenericErr(command, e instanceof Error ? e.message : String(e), opts.json);
    return { ok: false, exitCode: 1 };
  }
}

export async function runAgentVersionRetract(
  opts: AgentVersionRetractOptions,
): Promise<{ ok: boolean; exitCode: number }> {
  const command = "agent version retract";
  try {
    const auth = await resolveCliAuth({
      cwd: opts.cwd,
      profile: opts.profile,
      tenantId: opts.tenantId,
    });
    opts.debug(
      `agent version retract: tenant=${auth.tenantId} agent=${opts.agentId} version=${opts.versionId}`,
    );
    const client = new InternalAgentsGatewayClient({
      accessToken: auth.accessToken,
      apiBase: auth.apiBase,
      tenantId: auth.tenantId,
    });
    const data = await client.retractAgentVersion(opts.agentId, opts.versionId);
    if (opts.json) {
      console.log(JSON.stringify({ command, ok: true, result: data }, null, 2));
    } else {
      console.log(data === null ? "Retracted." : JSON.stringify(data, null, 2));
    }
    return { ok: true, exitCode: 0 };
  } catch (e) {
    if (e instanceof ManifestHttpError) {
      writeHttpErr(command, e, opts.json);
      return { ok: false, exitCode: 1 };
    }
    writeGenericErr(command, e instanceof Error ? e.message : String(e), opts.json);
    return { ok: false, exitCode: 1 };
  }
}
