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

/** Best-effort columns for internal gateway agent list items. */
export function renderAgentListTable(total: number, items: unknown[]): string {
  const table = new Table({
    head: [
      pc.bold("id"),
      pc.bold("name"),
      pc.bold("executionMode"),
      pc.bold("deployedVersionLabel"),
    ],
    style: { head: [], border: [] },
    wordWrap: true,
  });
  for (const raw of items) {
    const row =
      typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    table.push([
      cell(row.id),
      cell(row.name),
      cell(row.executionMode),
      cell(row.deployedVersionLabel),
    ]);
  }
  const lines = [table.toString(), pc.dim(`${total} agent(s) total`)];
  return lines.join("\n");
}
