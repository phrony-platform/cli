import type { PhronyManifestLlmProviderV1 } from "../schema/manifest-document.schemas.js";
import type { PhronyManifestVersionV1 } from "../schema/manifest-document.schemas.js";

/** Matches Phrony control-plane default when `maxTokensPerRun` is omitted from YAML. */
const DEFAULT_MAX_TOKENS_PER_RUN = 400_000;

/** Sorted copy for stable structural comparison (order alone must not surface as drift). */
function sortedStrings(xs: string[]): string[] {
  return [...xs].sort((a, b) => a.localeCompare(b));
}

function sortedAllowedOperations(
  xs: { serviceName: string; operationName: string }[],
): { serviceName: string; operationName: string }[] {
  return [...xs].sort((a, b) => {
    const ak = `${a.serviceName}\0${a.operationName}`;
    const bk = `${b.serviceName}\0${b.operationName}`;
    return ak.localeCompare(bk);
  });
}

/**
 * Canonical record for `versions[]` comparison — mirrors apply drift defaults on the server
 * so sparse YAML matches a verbose export.
 */
export function canonicalAgentVersionRecord(v: PhronyManifestVersionV1): Record<string, unknown> {
  const canSub = v.canExecuteSubAgents ?? false;
  const out: Record<string, unknown> = {
    agentManifestKey: v.agentManifestKey,
    status: v.status,
    versionLabel: v.versionLabel,
    llmModel: v.llmModel,
    inputSchema: v.inputSchema ?? {},
    outputSchema: v.outputSchema ?? {},
    instructions: v.instructions ?? "",
    description: v.description ?? null,
    temperature: v.temperature ?? 1,
    maxIterations: v.maxIterations ?? 10,
    maxTokensPerRun: v.maxTokensPerRun ?? DEFAULT_MAX_TOKENS_PER_RUN,
    maxToolCalls: v.maxToolCalls ?? 32,
    anomalyControl: v.anomalyControl ?? false,
    canExecuteSubAgents: canSub,
    rules: v.rules ?? [],
    allowedOperations: sortedAllowedOperations(v.allowedOperations ?? []),
    allowedSubAgents: sortedStrings(v.allowedSubAgents ?? []),
    maxSessionTokens: v.maxSessionTokens ?? null,
    maxSessionDurationSec: v.maxSessionDurationSec ?? null,
    topP: v.topP ?? null,
    topK: v.topK ?? null,
  };
  if (canSub) {
    out.subAgentExecutionModel = v.subAgentExecutionModel ?? "sequential";
  }
  return out;
}

/** Aligns with exported manifest LLM rows (`baseUrlOverride ?? null`). */
export function canonicalLlmProviderRecord(p: PhronyManifestLlmProviderV1): Record<string, unknown> {
  return {
    name: p.name,
    type: p.type,
    baseUrlOverride: p.baseUrlOverride ?? null,
  };
}
