import type { ResolvedCliAuth } from "./resolve-cli-auth.js";

/** Extra context when the gateway rejects the bearer token (typically HTTP 401). */
export function unauthorizedHttpHint(auth: ResolvedCliAuth): string {
  if (auth.mode === "access_token") {
    return (
      "Hint: PHRONY_ACCESS_TOKEN is set, so the CLI ignores --profile for the bearer token. " +
      "Unset PHRONY_ACCESS_TOKEN to use OAuth from ~/.phrony/credentials, or paste a current workspace access token from the dashboard."
    );
  }
  return `Hint: Try refreshing the session: phrony login --profile ${auth.profile}`;
}

export function formatHttpErrorForTerminal(
  status: number,
  detail: string,
  auth: ResolvedCliAuth,
): string {
  if (status !== 401) {
    return detail;
  }
  return `${detail}\n${unauthorizedHttpHint(auth)}`;
}
