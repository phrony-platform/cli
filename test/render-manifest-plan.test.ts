import { describe, expect, it } from "vitest";
import type { ManifestApplyResult } from "../src/schema/manifest-apply-result.schemas.js";
import { manifestApplyResultToDto } from "../src/lib/manifest-plan-dto.js";
import { renderManifestPlanTable } from "../src/lib/render-manifest-plan.js";
import { diffManifestTrees } from "../src/lib/manifest-structural-diff.js";
import type { PhronyManifestV1 } from "../src/schema/manifest-document.schemas.js";

const sampleApply: ManifestApplyResult = {
  dryRun: true,
  rootAgentId: "550e8400-e29b-41d4-a716-446655440000",
  changes: [
    { action: "CREATE", resource: "agent", key: "support" },
    {
      action: "UPDATE",
      resource: "agent_version",
      key: "support@v2",
      message: "llmModel changed",
    },
    { action: "NO_OP", resource: "service", key: "name:slack" },
    { action: "DELETE", resource: "trigger", key: "support@old-cron" },
  ],
  warnings: ["prune disabled: orphan resources retained"],
  servicesNeedingConnection: [
    { serviceId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8", name: "Slack", manifestKey: "slack" },
  ],
};

const localTree: PhronyManifestV1 = {
  kind: "phrony.manifest",
  version: 1,
  llmProviders: [{ name: "openai", type: "openai" }],
  agents: [{ manifestKey: "a1", name: "Agent One", executionMode: "request", llmProviderName: "openai" }],
  versions: [
    {
      agentManifestKey: "a1",
      status: "testing",
      versionLabel: "v1",
      llmModel: "gpt-4o",
    },
  ],
};

const remoteTree: PhronyManifestV1 = {
  kind: "phrony.manifest",
  version: 1,
  llmProviders: [{ name: "openai", type: "openai" }],
  agents: [{ manifestKey: "a1", name: "Agent Two", executionMode: "request", llmProviderName: "openai" }],
  versions: [
    {
      agentManifestKey: "a1",
      status: "testing",
      versionLabel: "v1",
      llmModel: "gpt-4o-mini",
    },
  ],
};

describe("manifestApplyResultToDto + renderManifestPlanTable", () => {
  it("builds a stable JSON DTO", () => {
    const dto = manifestApplyResultToDto(sampleApply);
    expect(dto).toMatchObject({
      dryRun: true,
      rootAgentId: sampleApply.rootAgentId,
      changes: expect.any(Array),
      warnings: sampleApply.warnings,
    });
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
  });

  it("renders a table containing change keys and warnings", () => {
    const dto = manifestApplyResultToDto(sampleApply);
    const text = renderManifestPlanTable(dto);
    expect(text).toContain("support@v2");
    expect(text).toContain("prune disabled");
    expect(text).toContain("6ba7b810-9dad-11d1-80b4-00c04fd430c8");
  });
});

describe("diffManifestTrees", () => {
  it("detects agent and version updates between trees", () => {
    const dto = diffManifestTrees(localTree, remoteTree);
    const keys = dto.changes.map((c) => `${c.action} ${c.resource} ${c.key}`).sort();
    expect(keys.some((k) => k.includes("UPDATE agent a1"))).toBe(true);
    expect(keys.some((k) => k.includes("UPDATE agent_version"))).toBe(true);
  });

  it("labels CREATE/DELETE rows for local vs remote-only resources", () => {
    const localSide: PhronyManifestV1 = {
      ...localTree,
      llmProviders: [...(localTree.llmProviders ?? []), { name: "extra_local", type: "anthropic" }],
    };
    const remoteSide: PhronyManifestV1 = {
      ...remoteTree,
      llmProviders: [...(remoteTree.llmProviders ?? []), { name: "extra_remote", type: "anthropic" }],
    };
    const dto = diffManifestTrees(localSide, remoteSide);
    const create = dto.changes.find((c) => c.action === "CREATE" && c.key === "extra_local");
    const del = dto.changes.find((c) => c.action === "DELETE" && c.key === "extra_remote");
    expect(create?.message).toContain("local manifest");
    expect(del?.message).toContain("remote export");
  });

  it("renders diff DTO with read-only labels (not apply/delete wording)", () => {
    const localSide: PhronyManifestV1 = {
      ...localTree,
      llmProviders: [...(localTree.llmProviders ?? []), { name: "extra_local", type: "anthropic" }],
    };
    const remoteSide: PhronyManifestV1 = {
      ...remoteTree,
      llmProviders: [...(remoteTree.llmProviders ?? []), { name: "extra_remote", type: "anthropic" }],
    };
    const dto = diffManifestTrees(localSide, remoteSide);
    expect(dto.presentation).toBe("structural_diff");
    const text = renderManifestPlanTable(dto);
    expect(text).toContain("Manifest diff");
    expect(text).toContain("remote only");
    expect(text).toContain("local only");
    expect(text).toContain("read-only");
    expect(text).not.toContain("\ndelete\n");
  });

  it("does not flag agent_version drift when sparse YAML matches verbose export (apply semantics)", () => {
    const base: PhronyManifestV1 = {
      kind: "phrony.manifest",
      version: 1,
      llmProviders: [{ name: "openai", type: "openai" }],
      agents: [
        {
          manifestKey: "example_root",
          name: "Example",
          executionMode: "request",
          llmProviderName: "openai",
        },
      ],
    };
    const sparse: PhronyManifestV1 = {
      ...base,
      versions: [
        {
          agentManifestKey: "example_root",
          status: "deployed",
          versionLabel: "v2",
          llmModel: "gpt-4o",
        },
      ],
    };
    const verbose: PhronyManifestV1 = {
      ...base,
      versions: [
        {
          agentManifestKey: "example_root",
          status: "deployed",
          versionLabel: "v2",
          llmModel: "gpt-4o",
          inputSchema: {},
          outputSchema: {},
          instructions: "",
          temperature: 1,
          maxIterations: 10,
          maxTokensPerRun: 400000,
          maxToolCalls: 32,
          anomalyControl: false,
          canExecuteSubAgents: false,
          rules: [],
          allowedOperations: [],
          allowedSubAgents: [],
        },
      ],
    };
    const dto = diffManifestTrees(sparse, verbose);
    expect(dto.changes.filter((c) => c.resource === "agent_version")).toHaveLength(0);
  });

  it("does not flag llm_provider_ref when baseUrlOverride is omitted vs null", () => {
    const a: PhronyManifestV1 = {
      kind: "phrony.manifest",
      version: 1,
      llmProviders: [{ name: "personal", type: "openai" }],
    };
    const b: PhronyManifestV1 = {
      kind: "phrony.manifest",
      version: 1,
      llmProviders: [{ name: "personal", type: "openai", baseUrlOverride: null }],
    };
    const dto = diffManifestTrees(a, b);
    expect(dto.changes.filter((c) => c.resource === "llm_provider_ref")).toHaveLength(0);
  });
});
