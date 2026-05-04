import { ManifestHttpError } from "./manifest-client.js";

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, "");
}

export type InternalAgentsClientOptions = {
  accessToken: string;
  apiBase: string;
  tenantId: string;
  fetchImpl?: typeof fetch;
};

/** Query forwarded to the gateway when either field is set (partial paging matches server defaults). */
export type ListAgentsQuery = {
  skip?: number;
  take?: number;
};

/**
 * Internal gateway JSON routes under `…/internal/v1/tenants/:tenantId/agents` with Bearer auth.
 */
export class InternalAgentsGatewayClient {
  private readonly accessToken: string;
  private readonly baseUrl: string;
  private readonly tenantId: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: InternalAgentsClientOptions) {
    this.accessToken = opts.accessToken;
    this.baseUrl = normalizeBase(opts.apiBase);
    this.tenantId = opts.tenantId;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async listAgents(query?: ListAgentsQuery): Promise<unknown> {
    const q = new URLSearchParams();
    if (query?.skip != null) {
      q.set("skip", String(query.skip));
    }
    if (query?.take != null) {
      q.set("take", String(query.take));
    }
    const suffix = q.toString() ? `?${q.toString()}` : "";
    const path = `/internal/v1/tenants/${this.tenantId}/agents${suffix}`;
    return this.getJson(path);
  }

  async getAgent(agentId: string): Promise<unknown> {
    const path = `/internal/v1/tenants/${this.tenantId}/agents/${agentId}`;
    return this.getJson(path);
  }

  async listAgentVersions(agentId: string, query?: ListAgentsQuery): Promise<unknown> {
    const q = new URLSearchParams();
    if (query?.skip != null) {
      q.set("skip", String(query.skip));
    }
    if (query?.take != null) {
      q.set("take", String(query.take));
    }
    const suffix = q.toString() ? `?${q.toString()}` : "";
    const path = `/internal/v1/tenants/${this.tenantId}/agents/${agentId}/versions${suffix}`;
    return this.getJson(path);
  }

  async getAgentVersion(agentId: string, versionId: string): Promise<unknown> {
    const path = `/internal/v1/tenants/${this.tenantId}/agents/${agentId}/versions/${versionId}`;
    return this.getJson(path);
  }

  async deployAgentVersion(agentId: string, versionId: string): Promise<unknown> {
    const path = `/internal/v1/tenants/${this.tenantId}/agents/${agentId}/versions/${versionId}/deploy`;
    return this.postJson(path, {});
  }

  async retractAgentVersion(agentId: string, versionId: string): Promise<unknown> {
    const path = `/internal/v1/tenants/${this.tenantId}/agents/${agentId}/versions/${versionId}/retract`;
    return this.postJson(path, {});
  }

  private async getJson(path: string): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const res = await this.fetchImpl(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new ManifestHttpError(res.status, path, text);
    }
    return JSON.parse(text) as unknown;
  }

  private async postJson(path: string, body: unknown): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new ManifestHttpError(res.status, path, text);
    }
    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }
    return JSON.parse(trimmed) as unknown;
  }
}
