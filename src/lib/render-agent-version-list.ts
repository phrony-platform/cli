import Table from "cli-table3";
import pc from "picocolors";

function cell(v: unknown): string {
  if (v === null || v === undefined) {
    return "";
  }
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  return JSON.stringify(v);
}

/** Columns for internal gateway agent version list items (`mapVersion` shape). */
export function renderAgentVersionListTable(total: number, items: unknown[]): string {
  const table = new Table({
    head: [pc.bold("id"), pc.bold("versionLabel"), pc.bold("status"), pc.bold("llmModel")],
    style: { head: [], border: [] },
    wordWrap: true,
  });
  for (const raw of items) {
    const row =
      typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    table.push([cell(row.id), cell(row.versionLabel), cell(row.status), cell(row.llmModel)]);
  }
  const lines = [table.toString(), pc.dim(`${total} version(s) total`)];
  return lines.join("\n");
}
