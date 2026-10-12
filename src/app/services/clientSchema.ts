import type { SchemaTable } from "../types/databaseSchema.types";
import { fetchJson } from "./clientApi";
import { parseSchemaInfo } from "./clientValidation";

let pending: Promise<{ tables: SchemaTable[] }> | undefined;
let pendingRefresh = false;

export function loadDatabaseSchema(
  refresh = false,
): Promise<{ tables: SchemaTable[] }> {
  if (pending) {
    return refresh && !pendingRefresh
      ? pending.then(() => loadDatabaseSchema(true))
      : pending;
  }
  pendingRefresh = refresh;
  pending = fetchJson("/api/database/schema", {
    method: refresh ? "POST" : "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  })
    .then(parseSchemaInfo)
    .finally(() => {
      pending = undefined;
      pendingRefresh = false;
    });
  return pending;
}
