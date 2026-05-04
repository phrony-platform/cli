/**
 * Single source of truth for manifest HTTP paths and semantics until the public API ships.
 *
 * Confirmed from phrony-platform gateway (2026-05):
 * - **Internal** (`Authorization: Bearer`): dashboard JWT, CLI OAuth access tokens, and **workspace access
 *   tokens** (`pwt_…` from the Phrony dashboard) call `POST …/internal/v1/tenants/:tenantId/agents/manifest/apply`
 *   (not `X-API-Key`). The gateway proxies to control-plane `POST /srv/v1/tenants/:tenantId/agents/manifest/apply`
 *   (`Content-Type: text/yaml`). Query: `dryRun`, `prune`, `nameSuffix`, `anchorAgentId` (UUID).
 * - **Internal export**: `GET …/internal/v1/tenants/:tenantId/agents/:agentId/manifest` →
 *   `GET /srv/v1/tenants/:tenantId/agents/:agentId/manifest` (YAML). Export is a **subtree from the
 *   given root agent id**, not an arbitrary workspace-wide file.
 * - **Public** `ExternalAgentsController` (`X-API-Key`): sessions + runs only — **no manifest routes**.
 *   The Phrony CLI does **not** use API keys for `plan` / `apply` / `diff`; use Bearer (`phrony login` or
 *   `PHRONY_ACCESS_TOKEN`) on internal routes only.
 *
 * Do not invent public URLs here; update this module when docs + gateway expose stable routes.
 */

export const PUBLIC_MANIFEST_HTTP_API_SUPPORTED = false as const;

/** Control-plane paths behind the internal gateway (reference for future public parity). */
export function srvManifestApplyPath(tenantId: string): string {
  return `/srv/v1/tenants/${tenantId}/agents/manifest/apply`;
}

export function srvAgentManifestExportPath(tenantId: string, agentId: string): string {
  return `/srv/v1/tenants/${tenantId}/agents/${agentId}/manifest`;
}

export type ManifestApplyQuery = {
  dryRun?: boolean;
  prune?: boolean;
  nameSuffix?: string;
  anchorAgentId?: string;
};

export function buildManifestApplySearchParams(q: ManifestApplyQuery): string {
  const sp = new URLSearchParams();
  if (q.dryRun) {
    sp.set("dryRun", "true");
  }
  if (q.prune) {
    sp.set("prune", "true");
  }
  if (q.nameSuffix != null && q.nameSuffix !== "") {
    sp.set("nameSuffix", q.nameSuffix);
  }
  if (q.anchorAgentId) {
    sp.set("anchorAgentId", q.anchorAgentId);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export class ManifestApiUnavailableError extends Error {
  readonly name = "ManifestApiUnavailableError";

  constructor(
    message = "Manifest apply/export is not available. Use `phrony login` (OAuth) or set PHRONY_ACCESS_TOKEN (Bearer on internal gateway routes).",
  ) {
    super(message);
  }
}

export function assertPublicManifestApiAvailable(): void {
  if (!PUBLIC_MANIFEST_HTTP_API_SUPPORTED) {
    throw new ManifestApiUnavailableError();
  }
}
