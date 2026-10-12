import type { DatabaseQueryResult, QueryValue } from "../types/query.types";

export const RESULTS_PAGE_SIZE = 10;
export const MIN_COLUMN_WIDTH = 60;
export const MAX_COLUMN_WIDTH = 800;
export const COLUMN_RESIZE_STEP = 20;

/** Preserve scalar types for sorting; format only at the display/export boundary. */
export function formatQueryValue(value: QueryValue): string {
  return value === null ? "NULL" : String(value);
}

export function compareQueryValues(
  left: QueryValue,
  right: QueryValue,
): number {
  if (left === right) return 0;
  if (left === null) return -1;
  if (right === null) return 1;
  if (typeof left === "number" && typeof right === "number")
    return left - right;
  if (typeof left === "boolean" && typeof right === "boolean")
    return Number(left) - Number(right);
  return String(left).localeCompare(String(right));
}

function csvCell(value: QueryValue): string {
  // Quoting alone does not prevent spreadsheet formula execution. Keep actual
  // negative numbers numeric; neutralize only strings interpreted as formulas.
  const text = value === null ? "" : String(value);
  const safe =
    typeof value === "string" && /^[\s\uFEFF]*[=+@-]/u.test(text)
      ? `'${text}`
      : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** Export the exact loaded snapshot, in database order, including column headers. */
export function queryResultCsv(result: DatabaseQueryResult): string {
  return [
    result.columns.map(csvCell).join(","),
    ...result.rows.map((row) =>
      result.columns.map((column) => csvCell(row[column])).join(","),
    ),
  ].join("\r\n");
}
