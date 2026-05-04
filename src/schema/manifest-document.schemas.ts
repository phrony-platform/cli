import { z } from "zod";
import {
  AgentExecutionModeApiSchema,
  AgentVersionStatusApiSchema,
  jsonObjectSchema,
  ServiceTypeApiSchema,
  SubAgentExecutionModelApiSchema,
} from "./manifest-shared.js";

/** Accept legacy draft kind values during transition. */
export const PhronyManifestKindSchema = z.union([
  z.literal("phrony.manifest"),
  z.literal("phrony.workspace.manifest"),
]);

export type PhronyManifestKind = z.infer<typeof PhronyManifestKindSchema>;

export const PhronyManifestIndexV1Schema = z.object({
  kind: z.literal("phrony.manifest.index"),
  version: z.literal(1),
  includes: z.array(z.string().min(1)),
});

export type PhronyManifestIndexV1 = z.infer<typeof PhronyManifestIndexV1Schema>;

export const PhronyManifestLlmProviderV1Schema = z.object({
  name: z.string().min(1),
  type: z.enum(["openai", "openai_azure", "anthropic", "self_hosted"]),
  baseUrlOverride: z.string().nullable().optional(),
});

export type PhronyManifestLlmProviderV1 = z.infer<typeof PhronyManifestLlmProviderV1Schema>;

export const PhronyManifestOperationV1Schema = z.object({
  manifestKey: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  configuration: jsonObjectSchema.optional(),
  requireApproval: z.boolean().optional(),
  argumentsSchema: jsonObjectSchema.nullable().optional(),
  secretsRedacted: z.boolean().optional(),
});

export type PhronyManifestOperationV1 = z.infer<typeof PhronyManifestOperationV1Schema>;

export const PhronyManifestServiceV1Schema = z.object({
  manifestKey: z.string().min(1).optional(),
  name: z.string().min(1),
  type: ServiceTypeApiSchema,
  config: jsonObjectSchema.optional(),
  secretsRedacted: z.boolean().optional(),
  operations: z.array(PhronyManifestOperationV1Schema).optional(),
});

export type PhronyManifestServiceV1 = z.infer<typeof PhronyManifestServiceV1Schema>;

export const PhronyManifestAgentV1Schema = z.object({
  manifestKey: z.string().min(1),
  name: z.string().min(1),
  executionMode: AgentExecutionModeApiSchema,
  llmProviderName: z.string().min(1),
});

export type PhronyManifestAgentV1 = z.infer<typeof PhronyManifestAgentV1Schema>;

export const PhronyManifestVersionV1Schema = z.object({
  agentManifestKey: z.string().min(1),
  status: AgentVersionStatusApiSchema,
  versionLabel: z.string().min(1, "versionLabel is required"),
  llmModel: z.string().min(1, "llmModel is required"),
  inputSchema: jsonObjectSchema.optional(),
  outputSchema: jsonObjectSchema.optional(),
  instructions: z.string().optional(),
  description: z.string().max(512).optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxIterations: z.number().int().positive().optional(),
  maxTokensPerRun: z.number().int().positive().optional(),
  maxToolCalls: z.number().int().positive().optional(),
  anomalyControl: z.boolean().optional(),
  canExecuteSubAgents: z.boolean().optional(),
  subAgentExecutionModel: SubAgentExecutionModelApiSchema.optional(),
  maxSessionTokens: z.number().int().positive().nullable().optional(),
  maxSessionDurationSec: z.number().int().positive().nullable().optional(),
  topP: z.number().min(0.1).max(1).nullable().optional(),
  topK: z.number().int().min(1).max(100).nullable().optional(),
  rules: z.array(z.unknown()).optional(),
  allowedOperations: z
    .array(
      z.object({
        serviceName: z.string().min(1),
        operationName: z.string().min(1),
      }),
    )
    .optional(),
  allowedSubAgents: z.array(z.string().min(1)).optional(),
});

export type PhronyManifestVersionV1 = z.infer<typeof PhronyManifestVersionV1Schema>;

const manifestTriggerScheduledSchema = z.object({
  manifestKey: z.string().min(1).optional(),
  agentManifestKey: z.string().min(1),
  name: z.string().min(1),
  type: z.literal("scheduled"),
  cronExpression: z.string().min(1),
  timezone: z.string().min(1),
  inputPayload: jsonObjectSchema.optional(),
});

const manifestTriggerApiSchema = z.object({
  manifestKey: z.string().min(1).optional(),
  agentManifestKey: z.string().min(1),
  name: z.string().min(1),
  type: z.literal("api"),
  rpmLimit: z.number().int().nonnegative().optional(),
  rpdLimit: z.number().int().nonnegative().optional(),
  maxConcurrentRuns: z.number().int().nonnegative().optional(),
  maxInputTokens: z.number().int().nonnegative().optional(),
  ipWhitelist: z.array(z.string().min(1)).optional(),
  exposeStepTimelineToApi: z.boolean().optional(),
});

const manifestTriggerEventSchema = z.object({
  manifestKey: z.string().min(1).optional(),
  agentManifestKey: z.string().min(1),
  name: z.string().min(1),
  type: z.literal("event"),
  serviceName: z.string().min(1),
  eventSlug: z.string().min(1),
  eventConfig: jsonObjectSchema.optional(),
});

export const PhronyManifestTriggerV1Schema = z.discriminatedUnion("type", [
  manifestTriggerScheduledSchema,
  manifestTriggerApiSchema,
  manifestTriggerEventSchema,
]);

export type PhronyManifestTriggerV1 = z.infer<typeof PhronyManifestTriggerV1Schema>;

export const PhronyManifestMetadataV1Schema = z.object({
  exportedAt: z.string().optional(),
  label: z.string().optional(),
  rootManifestKey: z.string().min(1).optional(),
});

export type PhronyManifestMetadataV1 = z.infer<typeof PhronyManifestMetadataV1Schema>;

export const PhronyManifestDocumentV1Schema = z.object({
  kind: PhronyManifestKindSchema,
  version: z.literal(1),
  metadata: PhronyManifestMetadataV1Schema.optional(),
  llmProviders: z.array(PhronyManifestLlmProviderV1Schema).optional(),
  services: z.array(PhronyManifestServiceV1Schema).optional(),
  agents: z.array(PhronyManifestAgentV1Schema).optional(),
  versions: z.array(PhronyManifestVersionV1Schema).optional(),
  triggers: z.array(PhronyManifestTriggerV1Schema).optional(),
});

export type PhronyManifestDocumentV1 = z.infer<typeof PhronyManifestDocumentV1Schema>;

export type PhronyManifestV1 = Omit<PhronyManifestDocumentV1, "kind"> & {
  kind: "phrony.manifest";
};
