import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse, bypass } from "msw";
import { setupServer } from "msw/node";
import { runBrowserOAuthLogin } from "../src/lib/oauth-login.js";
import { PHRONY_CLI_OAUTH_CLIENT_ID } from "../src/lib/pkce.js";

const apiBase = "https://gw.oauth.test";

const loginJson = {
  user: {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    email: "cli@test.local",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  tenant: {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    name: "Test workspace",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  tokens: {
    accessToken: "access.jwt",
    refreshToken: "refresh.opaque",
    accessExpiresIn: 3600,
  },
};

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("runBrowserOAuthLogin (MSW)", () => {
  it("completes init → callback → token with PKCE", async () => {
    server.use(
      http.post(`${apiBase}/public/v1/cli/oauth/init`, async ({ request }) => {
        const body = (await request.json()) as {
          redirect_uri: string;
          code_challenge: string;
          code_challenge_method: string;
          state: string;
          client_id: string;
        };
        expect(body.client_id).toBe(PHRONY_CLI_OAUTH_CLIENT_ID);
        expect(body.code_challenge_method).toBe("S256");
        expect(body.redirect_uri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
        const authorizeUrl = `${body.redirect_uri}?code=mock-auth-code&state=${encodeURIComponent(body.state)}`;
        return HttpResponse.json({
          sessionId: "00000000-0000-4000-8000-000000000001",
          authorizeUrl,
        });
      }),
      http.post(`${apiBase}/public/v1/cli/oauth/token`, async ({ request }) => {
        const body = (await request.json()) as {
          grant_type: string;
          client_id: string;
          code: string;
          redirect_uri: string;
          code_verifier: string;
        };
        expect(body.grant_type).toBe("authorization_code");
        expect(body.client_id).toBe(PHRONY_CLI_OAUTH_CLIENT_ID);
        expect(body.code).toBe("mock-auth-code");
        expect(body.redirect_uri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
        expect(body.code_verifier.length).toBeGreaterThanOrEqual(43);
        return HttpResponse.json(loginJson);
      }),
    );

    const result = await runBrowserOAuthLogin({
      apiBase,
      fetchImpl: fetch,
      openBrowser: async (url) => {
        const res = await fetch(bypass(url));
        expect(res.ok).toBe(true);
      },
      timeoutMs: 5000,
    });

    expect(result.tokens.accessToken).toBe("access.jwt");
    expect(result.tenant.id).toBe("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    expect(result.redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
  });
});
