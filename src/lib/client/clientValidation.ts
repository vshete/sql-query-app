import type { SchemaTable } from "../../types/databaseSchema.types";
import type {
  DatabaseQueryResult,
  QueryAgentResult,
  QueryValue,
} from "../../types/query.types";

/** Narrow external JSON to a non-null object before reading its fields. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Check every array member before trusting string-list fields from the server. */
function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

/** Accept only the finite scalar values supported by the result table and CSV contract. */
function isQueryValue(value: unknown): value is QueryValue {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

/** Validate table metadata and every column before exposing it to the schema explorer. */
function isSchemaTable(value: unknown): value is SchemaTable {
  return (
    isRecord(value) &&
    typeof value.schema === "string" &&
    typeof value.name === "string" &&
    isStringArray(value.constraints) &&
    Array.isArray(value.columns) &&
    value.columns.every(
      (column) =>
        isRecord(column) &&
        typeof column.name === "string" &&
        typeof column.type === "string" &&
        typeof column.nullable === "boolean" &&
        (column.default === null || typeof column.default === "string"),
    )
  );
}

/** Validate the schema endpoint payload and return only the metadata used by the browser. */
export function parseSchemaInfo(value: unknown): { tables: SchemaTable[] } {
  if (
    !isRecord(value) ||
    !Array.isArray(value.tables) ||
    !value.tables.every(isSchemaTable)
  ) {
    throw new Error("Invalid database schema response.");
  }
  return { tables: value.tables as SchemaTable[] };
}

/** Validate columns, scalar rows, and the loaded-row count before rendering a database result. */
export function parseQueryResult(value: unknown): DatabaseQueryResult {
  const columns =
    isRecord(value) && isStringArray(value.columns) ? value.columns : undefined;
  if (
    !isRecord(value) ||
    !columns ||
    !Array.isArray(value.rows) ||
    !value.rows.every(
      (row) =>
        isRecord(row) &&
        Object.values(row).every(isQueryValue) &&
        columns.every((column) => Object.hasOwn(row, column)),
    ) ||
    typeof value.rowCount !== "number" ||
    !Number.isSafeInteger(value.rowCount) ||
    value.rowCount !== value.rows.length ||
    typeof value.truncated !== "boolean" ||
    typeof value.message !== "string"
  ) {
    throw new Error("Invalid query result response.");
  }
  return value as unknown as DatabaseQueryResult;
}

/** Validate an answer-only or executed-query response, including any nested result table. */
export function parseAgentResult(value: unknown): QueryAgentResult {
  if (
    !isRecord(value) ||
    typeof value.generatedSQL !== "string" ||
    typeof value.explanation !== "string" ||
    !isStringArray(value.requiredTables) ||
    !isStringArray(value.warnings) ||
    (value.queryResult === undefined &&
      (value.generatedSQL !== "" || !value.explanation.trim()))
  ) {
    throw new Error("Invalid query agent response.");
  }

  return {
    generatedSQL: value.generatedSQL,
    explanation: value.explanation,
    requiredTables: value.requiredTables,
    warnings: value.warnings,
    ...(value.queryResult === undefined
      ? {}
      : { queryResult: parseQueryResult(value.queryResult) }),
  };
}

/** Use a non-empty API error when available; otherwise preserve the caller’s fallback message. */
export function responseError(value: unknown, fallback: string): string {
  return isRecord(value) &&
    typeof value.error === "string" &&
    value.error.trim()
    ? value.error
    : fallback;
}
