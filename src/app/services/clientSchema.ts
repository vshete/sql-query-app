import type { SchemaTable } from "../types/databaseSchema.types";
import { fetchJson } from "./clientApi";
import { parseSchemaInfo } from "./clientValidation";

let pending: Promise<{ tables: SchemaTable[] }> | undefined;
let cached: { tables: SchemaTable[] } | undefined;

/** Share browser metadata and in-flight requests; POST refresh replaces only a successful cached value. */
export function loadDatabaseSchema(
  refresh = false,
): Promise<{ tables: SchemaTable[] }> {
  if (pending) return pending;

  if (!refresh && cached) return Promise.resolve(cached);

  pending = fetchJson("/api/database/schema", {
    method: refresh ? "POST" : "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  })
    .then(parseSchemaInfo)
    .then((value) => {
      cached = value;
      return value;
    })
    .finally(() => {
      pending = undefined;
    });
  return pending;
}
