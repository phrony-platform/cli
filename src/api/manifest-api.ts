/**
 * Manifest HTTP helpers and feature flags for the Phrony CLI.
 *
 * `plan`, `apply`, and `diff` use `Authorization: Bearer` (OAuth from `phrony login` or
 * `PHRONY_ACCESS_TOKEN`) on workspace manifest routes — not `X-API-Key`. Apply accepts query parameters
 * `dryRun`, `prune`, `nameSuffix`, and `anchorAgentId` (UUID). Export for `diff` returns YAML for the
 * subtree rooted at the configured agent id, not an arbitrary workspace-wide snapshot.
 *
 * Apply accepts raw YAML (`Content-Type: text/yaml`) or JSON `{ yaml, inputs?, llmProviderOverrides? }`.
 * `POST …/manifest/preflight` accepts JSON `{ yaml, inputs? }` and returns structured blockers.
 *
 * Update this module when documented HTTP behaviour changes.
 */

export const PUBLIC_MANIFEST_HTTP_API_SUPPORTED = false as const;

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
