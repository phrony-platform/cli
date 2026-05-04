import { z } from "zod";

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
