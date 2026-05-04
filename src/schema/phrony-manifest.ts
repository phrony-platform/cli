/**
 * Vendored snapshot from phrony-platform `packages/srv-contracts/src/phrony-manifest.ts`.
 * Replace with a published `@phrony/manifest-schema` package when available; until then,
 * re-copy from srv-contracts after schema changes and run `pnpm test`.
 *
 * Schemas are split across `manifest-*.ts` modules; this file re-exports the public surface.
 */
export * from "./manifest-document.schemas.js";
export * from "./manifest-apply-result.schemas.js";
export * from "./manifest-yaml.js";
