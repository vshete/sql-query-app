import { executeDatabaseQuery } from "../database/database";
import type { QueryRequestContext } from "./queryAgent.types";
import { cleanAndValidateSql } from "../database/sqlValidation";

/** Execute only the SQL produced by this request; share its execution promise across duplicate calls. */
export async function executeQuery(
  context: QueryRequestContext,
  query: string,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const validated = cleanAndValidateSql(query, context.allowedTables);

  if (!context.generatedSQL || validated.sql !== context.generatedSQL) {
    throw new Error("Execute exactly the SQL returned by construct_sql.");
  }

  context.queryExecution ??= executeDatabaseQuery(
    validated.sql,
    signal,
    context.options.database,
  ).catch((error: unknown) => {
    context.toolError =
      error instanceof Error ? error : new Error(String(error));
    throw context.toolError;
  });
  context.queryResult = await context.queryExecution;

  return context.queryResult;
}
