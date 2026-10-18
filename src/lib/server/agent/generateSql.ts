import { getDatabaseSchema } from "../database/databaseSchema";
import type { QueryRequestContext } from "./queryAgent.types";
import { extractText, toHistoryMessages } from "./queryMessages";
import { formatSqlRequest } from "./queryPrompts";
import { cleanAndValidateSql } from "../database/sqlValidation";

/** Generate SQL once per request, stream provisional text, then validate it against cached schema. */
export async function generateSql(
  context: QueryRequestContext,
  naturalLanguage: string,
  signal?: AbortSignal,
) {
  // Cache the in-flight operation too: models can emit duplicate calls in one turn.
  // Keep failures cached so a repeated tool call cannot restart generation.
  context.sqlGeneration ??= (async () => {
    const { model, options, prompts } = context;
    const { text: schema, tables } = await getDatabaseSchema(options.database);

    context.allowedTables = new Set(
      tables.flatMap((table) => [
        `${table.schema}.${table.name}`,
        ...(table.schema === "public" ? [table.name] : []),
      ]),
    );

    signal?.throwIfAborted();
    options.onSqlStart?.();
    let sqlText = "";
    const stream = await model.stream(
      [
        {
          role: "system",
          content: prompts.sqlGeneration,
        },
        ...toHistoryMessages(options.history),
        {
          role: "user",
          content: formatSqlRequest(
            prompts.sqlRequest,
            schema,
            naturalLanguage,
          ),
        },
      ],
      { signal, tags: ["sql-generation"] },
    );

    for await (const chunk of stream) {
      signal?.throwIfAborted();
      const token = extractText(chunk.content);
      sqlText += token;
      if (token) options.onToken?.(token);
    }

    const validated = cleanAndValidateSql(sqlText, context.allowedTables);
    context.generatedSQL = validated.sql;
    context.requiredTables = validated.tables;
  })().catch((error: unknown) => {
    context.toolError =
      error instanceof Error ? error : new Error(String(error));
    throw context.toolError;
  });
  await context.sqlGeneration;

  return { sql: context.generatedSQL, tables: context.requiredTables };
}
