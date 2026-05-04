import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { InternalAgentsGatewayClient } from "../src/lib/internal-agents-client.js";

const tenant = "11111111-1111-1111-1111-111111111111";
const apiBase = "https://api.agents.test";
const agentId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const listPayload = {
  total: 1,
  items: [
    {
      id: agentId,
      tenantId: tenant,
      name: "Example",
      executionMode: "Request",
      llmProviderId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      deployedVersionId: null,
      deployedVersionLabel: null,
      deployedLlmModel: null,
      blockedUntilReviewed: false,
      blockedReason: null,
      blockedByIncidentId: null,
      blockedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
};

const versionId = "cccccccc-cccc-cccc-cccc-cccccccccccc";

const versionsListPayload = {
  total: 1,
  items: [
    {
      id: versionId,
      agentId,
      versionLabel: "v1",
      status: "Draft",
      llmModel: "gpt-4",
      inputSchema: {},
      outputSchema: {},
      instructions: "hi",
      description: null,
      temperature: 0,
      maxIterations: 10,
      maxTokensPerRun: 1000,
      maxToolCalls: 10,
      anomalyControl: null,
      allowedOperationIds: [],
      canExecuteSubAgents: false,
      subAgentExecutionModel: "None",
      allowedSubAgentIds: [],
      maxSessionTokens: null,
      maxSessionDurationSec: null,
      topP: null,
      topK: null,
      rules: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
};

const internalListPath = `/internal/v1/tenants/${tenant}/agents`;
const internalGetPath = `/internal/v1/tenants/${tenant}/agents/${agentId}`;
const internalVersionsPath = `/internal/v1/tenants/${tenant}/agents/${agentId}/versions`;
const internalVersionGetPath = `/internal/v1/tenants/${tenant}/agents/${agentId}/versions/${versionId}`;
const internalDeployPath = `/internal/v1/tenants/${tenant}/agents/${agentId}/versions/${versionId}/deploy`;
const internalRetractPath = `/internal/v1/tenants/${tenant}/agents/${agentId}/versions/${versionId}/retract`;

const server = setupServer(
  http.get(`${apiBase}${internalListPath}`, ({ request }) => {
    expect(request.headers.get("authorization")).toBe("Bearer test-access");
    const u = new URL(request.url);
    if (u.searchParams.has("skip")) {
      expect(u.searchParams.get("skip")).toBe("5");
    }
    if (u.searchParams.has("take")) {
      expect(u.searchParams.get("take")).toBe("10");
    }
    return HttpResponse.json(listPayload);
  }),
  http.get(`${apiBase}${internalGetPath}`, ({ request }) => {
    expect(request.headers.get("authorization")).toBe("Bearer test-access");
    return HttpResponse.json(listPayload.items[0]);
  }),
  http.get(`${apiBase}${internalVersionsPath}`, ({ request }) => {
    expect(request.headers.get("authorization")).toBe("Bearer test-access");
    const u = new URL(request.url);
    if (u.searchParams.has("skip")) {
      expect(u.searchParams.get("skip")).toBe("1");
    }
    if (u.searchParams.has("take")) {
      expect(u.searchParams.get("take")).toBe("5");
    }
    return HttpResponse.json(versionsListPayload);
  }),
  http.get(`${apiBase}${internalVersionGetPath}`, ({ request }) => {
    expect(request.headers.get("authorization")).toBe("Bearer test-access");
    return HttpResponse.json(versionsListPayload.items[0]);
  }),
  http.post(`${apiBase}${internalDeployPath}`, async ({ request }) => {
    expect(request.headers.get("authorization")).toBe("Bearer test-access");
    expect(request.headers.get("content-type")).toContain("json");
    const body = await request.json();
    expect(body).toEqual({});
    return HttpResponse.json({ ok: true, deployedVersionId: versionId });
  }),
  http.post(`${apiBase}${internalRetractPath}`, async ({ request }) => {
    expect(request.headers.get("authorization")).toBe("Bearer test-access");
    const body = await request.json();
    expect(body).toEqual({});
    return HttpResponse.json({ ok: true });
  }),
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("InternalAgentsGatewayClient", () => {
  it("lists agents without query params", async () => {
    const c = new InternalAgentsGatewayClient({
      apiBase,
      tenantId: tenant,
      accessToken: "test-access",
    });
    const out = await c.listAgents();
    expect(out).toEqual(listPayload);
  });

  it("forwards skip and take", async () => {
    const c = new InternalAgentsGatewayClient({
      apiBase,
      tenantId: tenant,
      accessToken: "test-access",
    });
    await c.listAgents({ skip: 5, take: 10 });
  });

  it("gets one agent", async () => {
    const c = new InternalAgentsGatewayClient({
      apiBase,
      tenantId: tenant,
      accessToken: "test-access",
    });
    const out = await c.getAgent(agentId);
    expect(out).toEqual(listPayload.items[0]);
  });

  it("lists agent versions", async () => {
    const c = new InternalAgentsGatewayClient({
      apiBase,
      tenantId: tenant,
      accessToken: "test-access",
    });
    const out = await c.listAgentVersions(agentId);
    expect(out).toEqual(versionsListPayload);
    await c.listAgentVersions(agentId, { skip: 1, take: 5 });
  });

  it("gets one agent version", async () => {
    const c = new InternalAgentsGatewayClient({
      apiBase,
      tenantId: tenant,
      accessToken: "test-access",
    });
    const out = await c.getAgentVersion(agentId, versionId);
    expect(out).toEqual(versionsListPayload.items[0]);
  });

  it("deploys and retracts a version", async () => {
    const c = new InternalAgentsGatewayClient({
      apiBase,
      tenantId: tenant,
      accessToken: "test-access",
    });
    expect(await c.deployAgentVersion(agentId, versionId)).toEqual({
      ok: true,
      deployedVersionId: versionId,
    });
    expect(await c.retractAgentVersion(agentId, versionId)).toEqual({ ok: true });
  });
});
