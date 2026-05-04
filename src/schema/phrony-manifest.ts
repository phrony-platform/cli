/**
 * JSON Schema types and helpers for Phrony manifest YAML (`phrony lint` uses these offline).
 * When the upstream manifest contract changes, update these modules and run `pnpm test`.
 *
 * Schemas are split across `manifest-*.ts` modules; this file re-exports the public surface.
 */
export * from "./manifest-document.schemas.js";
export * from "./manifest-apply-result.schemas.js";
export * from "./manifest-yaml.js";
