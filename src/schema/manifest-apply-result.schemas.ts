import { z } from "zod";

import { PhronyManifestInputDeclV1Schema } from "./manifest-document.schemas.js";

export const ManifestChangeActionSchema = z.enum(["CREATE", "UPDATE", "NO_OP", "DELETE"]);

export type ManifestChangeAction = z.infer<typeof ManifestChangeActionSchema>;

export const ManifestChangeResourceSchema = z.enum([
  "agent",
  "agent_version",
  "service",
  "operation",
  "trigger",
  "llm_provider_ref",
]);

export type ManifestChangeResource = z.infer<typeof ManifestChangeResourceSchema>;

export const ManifestChangeEntrySchema = z.object({
  action: ManifestChangeActionSchema,
  resource: ManifestChangeResourceSchema,
  key: z.string(),
  message: z.string().optional(),
});

export type ManifestChangeEntry = z.infer<typeof ManifestChangeEntrySchema>;

export const ManifestServiceNeedingConnectionSchema = z.object({
  serviceId: z.string().uuid(),
  name: z.string(),
  manifestKey: z.string().optional(),
});

export type ManifestServiceNeedingConnection = z.infer<typeof ManifestServiceNeedingConnectionSchema>;

export const ManifestApplyResultSchema = z.object({
  dryRun: z.boolean(),
  rootAgentId: z.string().min(1),
  changes: z.array(ManifestChangeEntrySchema),
  warnings: z.array(z.string()).optional(),
  resolvedAgentManifestKeys: z.record(z.string(), z.string()).optional(),
  resolvedServiceManifestKeys: z.record(z.string(), z.string()).optional(),
  servicesNeedingConnection: z.array(ManifestServiceNeedingConnectionSchema).optional(),
});

export type ManifestApplyResult = z.infer<typeof ManifestApplyResultSchema>;

export const ManifestPreflightBlockerSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("missing_llm_provider"),
    names: z.array(z.string()),
  }),
  z.object({
    kind: z.literal("malformed_placeholder"),
    samples: z.array(z.string()),
  }),
  z.object({
    kind: z.literal("undeclared_input_placeholder"),
    keys: z.array(z.string()),
  }),
]);

export type ManifestPreflightBlocker = z.infer<typeof ManifestPreflightBlockerSchema>;

export const ManifestPreflightResultSchema = z.object({
  ok: z.boolean(),
  blockers: z.array(ManifestPreflightBlockerSchema),
  parseError: z.string().optional(),
  missingInputs: z.array(z.string()).optional(),
  referencedInputKeys: z.array(z.string()).optional(),
  /** Merged `inputs[]` from raw manifest documents (for UI control types). */
  declaredInputs: z.array(PhronyManifestInputDeclV1Schema).optional(),
});

export type ManifestPreflightResult = z.infer<typeof ManifestPreflightResultSchema>;
