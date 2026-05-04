export type SkipTakeParseResult =
  | { ok: true; skip?: number; take?: number }
  | { ok: false; message: string };

/** Parses `--skip` / `--take` option strings from Commander (omit both for unpaginated API calls). */
export function parseSkipTakeCli(opts: { skip?: string; take?: string }): SkipTakeParseResult {
  let skip: number | undefined;
  let take: number | undefined;
  try {
    if (opts.skip != null && opts.skip !== "") {
      const n = Number.parseInt(opts.skip, 10);
      if (!Number.isFinite(n) || n < 0) {
        return { ok: false, message: "--skip must be a non-negative integer" };
      }
      skip = n;
    }
    if (opts.take != null && opts.take !== "") {
      const n = Number.parseInt(opts.take, 10);
      if (!Number.isFinite(n) || n < 1) {
        return { ok: false, message: "--take must be a positive integer" };
      }
      take = n;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
  return { ok: true, skip, take };
}
