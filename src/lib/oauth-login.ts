import { execFile } from "node:child_process";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { URL } from "node:url";
import {
  cliOAuthInitBody,
  postCliOAuthInit,
  postCliOAuthToken,
  type CliOAuthLoginResponse,
} from "./cli-oauth-api.js";
import { PHRONY_CLI_OAUTH_CLIENT_ID, pkceChallengeS256, randomOAuthState, randomPkceVerifier } from "./pkce.js";

const CALLBACK_PATH = "/callback";

export type CliOAuthLoginDeps = {
  fetchImpl?: typeof fetch;
  /** Opens the dashboard authorize URL (default: OS default browser). */
  openBrowser?: (url: string) => void | Promise<void>;
};

function defaultOpenBrowser(url: string): void {
  const platform = process.platform;
  if (platform === "darwin") {
    execFile("open", [url], () => {});
  } else if (platform === "win32") {
    execFile("cmd", ["/c", "start", "", url], { windowsHide: true }, () => {});
  } else {
    execFile("xdg-open", [url], () => {});
  }
}

function parseCallback(req: IncomingMessage, expectedState: string | undefined): { code: string } {
  const host = req.headers.host ?? "127.0.0.1";
  const u = new URL(req.url ?? "/", `http://${host}`);
  if (u.pathname !== CALLBACK_PATH) {
    throw new Error(`Unexpected callback path: ${u.pathname}`);
  }
  const err = u.searchParams.get("error");
  if (err) {
    const desc = u.searchParams.get("error_description") ?? "";
    throw new Error(`Authorization failed: ${err}${desc ? ` — ${desc}` : ""}`);
  }
  const code = u.searchParams.get("code");
  if (!code) {
    throw new Error("Missing authorization code in callback");
  }
  if (expectedState !== undefined) {
    const st = u.searchParams.get("state");
    if (st !== expectedState) {
      throw new Error("OAuth state mismatch (possible CSRF)");
    }
  }
  return { code };
}

function startCallbackServer(params: {
  host: string;
  expectedState: string | undefined;
  timeoutMs: number;
}): Promise<{ server: Server; redirectUri: string; waitForCode: () => Promise<string> }> {
  return new Promise((resolveMeta, rejectMeta) => {
    let settled = false;
    let resolveCode!: (code: string) => void;
    let rejectCode!: (e: Error) => void;
    const codePromise = new Promise<string>((resolve, reject) => {
      resolveCode = resolve;
      rejectCode = reject;
    });

    const server = createServer((req, res) => {
      try {
        const { code } = parseCallback(req, params.expectedState);
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(
          "<!doctype html><title>Phrony CLI</title><p>You can close this window and return to the terminal.</p>",
        );
        okOnce(code);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.statusCode = 400;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end(msg);
        failOnce(e instanceof Error ? e : new Error(msg));
      }
    });

    function failOnce(e: Error): void {
      if (settled) {
        return;
      }
      settled = true;
      rejectCode(e);
      server.close();
    }

    function okOnce(code: string): void {
      if (settled) {
        return;
      }
      settled = true;
      resolveCode(code);
      server.close();
    }

    const timer = setTimeout(() => {
      failOnce(new Error("Timed out waiting for browser callback (try again)."));
    }, params.timeoutMs);

    codePromise.finally(() => clearTimeout(timer));

    server.once("error", (err) => {
      rejectMeta(err);
    });

    server.listen(0, params.host, () => {
      const addr = server.address();
      if (addr == null || typeof addr === "string") {
        server.close();
        rejectMeta(new Error("Failed to bind callback server"));
        return;
      }
      const redirectUri = `http://${params.host}:${addr.port}${CALLBACK_PATH}`;
      resolveMeta({
        server,
        redirectUri,
        waitForCode: () => codePromise,
      });
    });
  });
}

export type RunBrowserOAuthLoginOptions = {
  /** Gateway API origin without trailing slash (same as manifest commands). */
  apiBase: string;
  /** Bind address for loopback redirect (127.0.0.1 recommended). */
  callbackHost?: string;
  /** Max wait for user to complete browser flow. */
  timeoutMs?: number;
} & CliOAuthLoginDeps;

/**
 * PKCE authorization-code login: local callback server, init, browser, token exchange.
 */
export async function runBrowserOAuthLogin(
  opts: RunBrowserOAuthLoginOptions,
): Promise<CliOAuthLoginResponse & { redirectUri: string }> {
  const apiBase = opts.apiBase.replace(/\/+$/, "");
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const openBrowser = opts.openBrowser ?? defaultOpenBrowser;
  const host = opts.callbackHost ?? "127.0.0.1";
  const timeoutMs = opts.timeoutMs ?? 20 * 60 * 1000;

  const codeVerifier = randomPkceVerifier();
  const codeChallenge = pkceChallengeS256(codeVerifier);
  const state = randomOAuthState();

  const { redirectUri, waitForCode } = await startCallbackServer({
    host,
    expectedState: state,
    timeoutMs,
  });

  const initBody = cliOAuthInitBody({
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    state,
  });
  const { authorizeUrl } = await postCliOAuthInit(apiBase, initBody, fetchImpl);
  await openBrowser(authorizeUrl);

  const code = await waitForCode();
  const login = await postCliOAuthToken(
    apiBase,
    {
      grant_type: "authorization_code",
      client_id: PHRONY_CLI_OAUTH_CLIENT_ID,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    },
    fetchImpl,
  );

  return { ...login, redirectUri };
}
