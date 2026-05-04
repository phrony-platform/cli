import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createManifestClient } from "../src/lib/manifest-client.js";

const tenant = "11111111-1111-1111-1111-111111111111";
const apiBase = "https://api.jwt.test";
const yamlBody = "kind: phrony.manifest\nversion: 1\n";

const applyJson = {
  dryRun: true,
  rootAgentId: "550e8400-e29b-41d4-a716-446655440000",
  changes: [],
};

const internalApplyPath = `/internal/v1/tenants/${tenant}/agents/manifest/apply`;
const internalExportPath = `/internal/v1/tenants/${tenant}/agents/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/manifest`;

const server = setupServer(
  http.post(`${apiBase}${internalApplyPath}`, async ({ request }) => {
    const u = new URL(request.url);
    expect(u.searchParams.get("dryRun")).toBe("true");
    expect(request.headers.get("authorization")).toBe("Bearer test-access");
    expect(request.headers.get("content-type")).toContain("yaml");
    return HttpResponse.json(applyJson);
  }),
  http.get(`${apiBase}${internalExportPath}`, () =>
    HttpResponse.text(yamlBody, { headers: { "Content-Type": "text/yaml" } }),
  ),
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("createManifestClient bearer (internal gateway)", () => {
  it("uses internal manifest paths with Authorization Bearer", async () => {
    const client = createManifestClient({
      apiBase,
      tenantId: tenant,
      auth: { type: "bearer", accessToken: "test-access" },
    });
    const r = await client.applyManifestYaml(yamlBody, { dryRun: true });
    expect(r.rootAgentId).toBe(applyJson.rootAgentId);
    const y = await client.exportAgentManifestYaml("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(y).toContain("phrony.manifest");
  });
});
