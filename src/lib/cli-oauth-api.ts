import { z } from "zod";
import { PHRONY_CLI_OAUTH_CLIENT_ID } from "./pkce.js";

const TokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  accessExpiresIn: z.number(),
});

const AuthEntitySchema = z.object({
  id: z.string(),
  createdAt: z.union([z.string(), z.coerce.date()]),
});

const LoginResponseSchema = z.object({
  user: AuthEntitySchema.extend({ email: z.string() }),
  tenant: AuthEntitySchema.extend({ name: z.string() }),
  tokens: TokenPairSchema,
});

export type CliOAuthLoginResponse = z.infer<typeof LoginResponseSchema>;

export async function postCliOAuthInit(
  apiBase: string,
  body: {
    client_id: string;
    redirect_uri: string;
    code_challenge: string;
    code_challenge_method: "S256";
    state?: string;
  },
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<{ sessionId: string; authorizeUrl: string }> {
  const url = `${apiBase.replace(/\/+$/, "")}/public/v1/cli/oauth/init`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`CLI OAuth init failed (${res.status}): ${text.slice(0, 800)}`);
  }
  const json = JSON.parse(text) as unknown;
  const parsed = z
    .object({ sessionId: z.string(), authorizeUrl: z.string().url() })
    .safeParse(json);
  if (!parsed.success) {
    throw new Error("CLI OAuth init: unexpected response shape");
  }
  return parsed.data;
}

export async function postCliOAuthToken(
  apiBase: string,
  body: {
    grant_type: "authorization_code";
    client_id: string;
    code: string;
    redirect_uri: string;
    code_verifier: string;
  },
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<CliOAuthLoginResponse> {
  const url = `${apiBase.replace(/\/+$/, "")}/public/v1/cli/oauth/token`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`CLI OAuth token exchange failed (${res.status}): ${text.slice(0, 800)}`);
  }
  const json = JSON.parse(text) as unknown;
  return LoginResponseSchema.parse(json);
}

export async function postCliOAuthRefresh(
  apiBase: string,
  refreshToken: string,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<CliOAuthLoginResponse> {
  const url = `${apiBase.replace(/\/+$/, "")}/public/v1/cli/oauth/refresh`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`CLI OAuth refresh failed (${res.status}): ${text.slice(0, 800)}`);
  }
  const json = JSON.parse(text) as unknown;
  return LoginResponseSchema.parse(json);
}

export function cliOAuthInitBody(params: {
  redirect_uri: string;
  code_challenge: string;
  state?: string;
}): {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: "S256";
  state?: string;
} {
  return {
    client_id: PHRONY_CLI_OAUTH_CLIENT_ID,
    redirect_uri: params.redirect_uri,
    code_challenge: params.code_challenge,
    code_challenge_method: "S256",
    ...(params.state !== undefined ? { state: params.state } : {}),
  };
}
