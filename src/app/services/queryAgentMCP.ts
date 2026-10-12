import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Sequelize } from "sequelize";
import { z } from "zod";
import type { DatabaseQueryResult } from "../types/query.types";
import { executeDatabaseQuery } from "./database";
import { getDatabaseSchema } from "./databaseSchema";
import { formatSqlRequest, type QueryPrompts } from "./queryPrompts";
import { cleanAndValidateSql } from "./sqlValidation";

export interface QueryAgentOptions {
  onToken?: (token: string) => void;
  onAgentToken?: (token: string) => void;
  onSqlStart?: () => void;
  signal?: AbortSignal;
  database?: Sequelize;
}

export interface QueryRequestContext {
  model: BaseChatModel;
  prompts: QueryPrompts;
  options: QueryAgentOptions;
  modelCalls: number;
  generatedSQL: string;
  requiredTables: string[];
  allowedTables?: Set<string>;
  queryResult?: DatabaseQueryResult;
  toolError?: Error;
  sqlGeneration?: Promise<void>;
  queryExecution?: Promise<DatabaseQueryResult>;
}

export const requestContexts = new Map<string, QueryRequestContext>();

function getRequestContext(requestId: string): QueryRequestContext {
  const context = requestContexts.get(requestId);
  if (!context) throw new Error("Query request is no longer active.");
  return context;
}

export function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "object" && part !== null && "text" in part
          ? String(part.text)
          : "",
      )
      .join("");
  }
  return "";
}

export async function initializeMcpServer(
  prompts: QueryPrompts,
): Promise<Client> {
  const mcpServer = new McpServer({ name: "query-app-demo", version: "1.0.0" });
  const mcpClient = new Client({ name: "query-app-agent", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  mcpServer.registerTool(
    "construct_sql",
    {
      description: prompts.mcpConstructSql,
      inputSchema: { request: z.string(), requestId: z.string() },
    },
    async ({ request: naturalLanguage, requestId }) => {
      const context = getRequestContext(requestId);
      // Cache the in-flight operation too: models can emit duplicate calls in one turn.
      // Keep failures cached so a repeated tool call cannot restart generation.
      context.sqlGeneration ??= (async () => {
        const { model, options, prompts } = context;
        const { text: schema, tables } = await getDatabaseSchema(
          options.database,
        );

        context.allowedTables = new Set(
          tables.flatMap((table) => [
            `${table.schema}.${table.name}`,
            ...(table.schema === "public" ? [table.name] : []),
          ]),
        );

        options.onSqlStart?.();
        let sqlText = "";
        const stream = await model.stream(
          [
            {
              role: "system",
              content: prompts.sqlGeneration,
            },
            {
              role: "user",
              content: formatSqlRequest(
                prompts.sqlRequest,
                schema,
                naturalLanguage,
              ),
            },
          ],
          { signal: options.signal, tags: ["sql-generation"] },
        );

        for await (const chunk of stream) {
          const token = extractText(chunk.content);
          sqlText += token;
          if (token) options.onToken?.(token);
        }

        const validated = cleanAndValidateSql(sqlText, context.allowedTables);
        context.generatedSQL = validated.sql;
        context.requiredTables = validated.tables;
        console.debug("Generated SQL:", validated.sql);
        console.debug("Generated required tables", validated.tables);
      })().catch((error: unknown) => {
        context.toolError =
          error instanceof Error ? error : new Error(String(error));
        throw context.toolError;
      });
      await context.sqlGeneration;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              sql: context.generatedSQL,
              tables: context.requiredTables,
            }),
          },
        ],
      };
    },
  );

  mcpServer.registerTool(
    "execute_query",
    {
      description: prompts.mcpExecuteQuery,
      inputSchema: { query: z.string(), requestId: z.string() },
    },
    async ({ query, requestId }) => {
      const context = getRequestContext(requestId);
      const validated = cleanAndValidateSql(query, context.allowedTables);
      if (!context.generatedSQL || validated.sql !== context.generatedSQL) {
        throw new Error("Execute exactly the SQL returned by construct_sql.");
      }
      console.debug("Executing SQL:", validated.sql);
      context.queryExecution ??= executeDatabaseQuery(
        validated.sql,
        context.options.signal,
        context.options.database,
      ).catch((error: unknown) => {
        context.toolError =
          error instanceof Error ? error : new Error(String(error));
        throw context.toolError;
      });
      context.queryResult = await context.queryExecution;
      return {
        content: [{ type: "text", text: JSON.stringify(context.queryResult) }],
      };
    },
  );

  try {
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return mcpClient;
  } catch (error) {
    await Promise.allSettled([mcpClient.close(), mcpServer.close()]);
    throw error;
  }
}
