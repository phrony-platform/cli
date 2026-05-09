import {
  PUBLIC_MANIFEST_HTTP_API_SUPPORTED,
  buildManifestApplySearchParams,
  ManifestApiUnavailableError,
  type ManifestApplyQuery,
} from "../api/manifest-api.js";
import {
  ManifestApplyResultSchema,
  ManifestPreflightResultSchema,
  type ManifestApplyResult,
  type ManifestPreflightResult,
} from "../schema/manifest-apply-result.schemas.js";
import { formatGatewayErrorBody } from "./format-gateway-error-body.js";
import type { ResolvedCliAuth } from "./resolve-cli-auth.js";

export type { ManifestApplyQuery, ManifestApplyResult, ManifestPreflightResult };

export type ManifestAuth = { type: "bearer"; accessToken: string };

export type ManifestClientOptions = {
  /** API base without trailing slash */
  apiBase: string;
  tenantId: string;
  auth: ManifestAuth;
  fetchImpl?: typeof fetch;
};

export type ManifestApplyTransportOptions = {
  inputs?: Record<string, string>;
  llmProviderOverrides?: Record<string, string>;
};

export interface ManifestClient {
  applyManifestYaml(
    yaml: string,
    query: ManifestApplyQuery,
    transport?: ManifestApplyTransportOptions,
  ): Promise<ManifestApplyResult>;
  preflightManifest(body: {
    yaml: string;
    inputs?: Record<string, string>;
    llmProviderOverrides?: Record<string, string>;
  }): Promise<ManifestPreflightResult>;
  exportAgentManifestYaml(agentId: string): Promise<string>;
}

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, "");
}

export class ManifestHttpError extends Error {
  readonly name = "ManifestHttpError";
  /** Raw response body from the gateway (may be JSON or plain text). */
  readonly body: string;
  constructor(
    readonly status: number,
    readonly path: string,
    body: string,
  ) {
    const detail = formatGatewayErrorBody(body);
    super(detail);
    this.body = body;
  }
}

function internalManifestApplyPath(tenantId: string, query: ManifestApplyQuery): string {
  return `/internal/v1/tenants/${tenantId}/agents/manifest/apply${buildManifestApplySearchParams(query)}`;
}

function internalManifestExportPath(tenantId: string, agentId: string): string {
  return `/internal/v1/tenants/${tenantId}/agents/${agentId}/manifest`;
}

function internalManifestPreflightPath(tenantId: string): string {
  return `/internal/v1/tenants/${tenantId}/agents/manifest/preflight`;
}

/**
 * Gateway internal manifest routes with `Authorization: Bearer` (OAuth JWT or workspace access token).
 */
export class JwtGatewayManifestClient implements ManifestClient {
  private readonly accessToken: string;
  private readonly baseUrl: string;
  private readonly tenantId: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: { accessToken: string; apiBase: string; tenantId: string; fetchImpl?: typeof fetch }) {
    this.accessToken = opts.accessToken;
    this.baseUrl = normalizeBase(opts.apiBase);
    this.tenantId = opts.tenantId;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async preflightManifest(body: {
    yaml: string;
    inputs?: Record<string, string>;
    llmProviderOverrides?: Record<string, string>;
  }): Promise<ManifestPreflightResult> {
    const path = internalManifestPreflightPath(this.tenantId);
    const url = `${this.baseUrl}${path}`;
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new ManifestHttpError(res.status, path, text);
    }
    return ManifestPreflightResultSchema.parse(JSON.parse(text));
  }

  async applyManifestYaml(
    yaml: string,
    query: ManifestApplyQuery,
    transport?: ManifestApplyTransportOptions,
  ): Promise<ManifestApplyResult> {
    const path = internalManifestApplyPath(this.tenantId, query);
    const url = `${this.baseUrl}${path}`;
    const useJson =
      (transport?.inputs && Object.keys(transport.inputs).length > 0) ||
      (transport?.llmProviderOverrides && Object.keys(transport.llmProviderOverrides).length > 0);
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": useJson ? "application/json" : "text/yaml",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: useJson
        ? JSON.stringify({
            yaml,
            ...(transport?.inputs && Object.keys(transport.inputs).length > 0
              ? { inputs: transport.inputs }
              : {}),
            ...(transport?.llmProviderOverrides &&
            Object.keys(transport.llmProviderOverrides).length > 0
              ? { llmProviderOverrides: transport.llmProviderOverrides }
              : {}),
          })
        : yaml,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new ManifestHttpError(res.status, path, text);
    }
    return ManifestApplyResultSchema.parse(JSON.parse(text));
  }

  async exportAgentManifestYaml(agentId: string): Promise<string> {
    const path = internalManifestExportPath(this.tenantId, agentId);
    const url = `${this.baseUrl}${path}`;
    const res = await this.fetchImpl(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new ManifestHttpError(res.status, path, text);
    }
    return text;
  }
}

export function manifestClientOptionsFromResolved(auth: ResolvedCliAuth): ManifestClientOptions {
  return {
    apiBase: auth.apiBase,
    tenantId: auth.tenantId,
    auth: { type: "bearer", accessToken: auth.accessToken },
  };
}

/**
 * Creates a manifest HTTP client. The CLI only uses **internal** gateway routes with
 * `Authorization: Bearer` (OAuth or `PHRONY_ACCESS_TOKEN`).
 */
export function createManifestClient(opts: ManifestClientOptions): ManifestClient {
  if (PUBLIC_MANIFEST_HTTP_API_SUPPORTED) {
    throw new ManifestApiUnavailableError(
      "This CLI build uses internal Bearer routes only. Public manifest API key mode is not enabled here.",
    );
  }
  return new JwtGatewayManifestClient({
    accessToken: opts.auth.accessToken,
    apiBase: opts.apiBase,
    tenantId: opts.tenantId,
    fetchImpl: opts.fetchImpl,
  });
}
