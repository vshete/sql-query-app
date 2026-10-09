import type { DatabaseQueryResult } from "../types/query.types";
import { executeDatabaseQuery } from "./database";
import { cleanAndValidateSql } from "./sqlValidation";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {formatSqlRequest, type QueryPrompts } from "./queryPrompts";


const SCHEMA_URI = "postgres://database/schema";


export interface QueryAgentOptions {
  onToken?: (token: string) => void;
  onAgentToken?: (token: string) => void;
  onSqlStart?: () => void;
  signal?: AbortSignal;
}


export interface QueryRequestContext {
  model: BaseChatModel;
  prompts: QueryPrompts;
  options: QueryAgentOptions;
  generatedSQL: string;
  requiredTables: string[];
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


export async function initializeMcpServer(prompts: QueryPrompts): Promise<Client> {
  const mcpServer = new McpServer({ name: "query-app-demo", version: "1.0.0" });
  const mcpClient = new Client({ name: "query-app-agent", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  mcpServer.registerResource(
    "database-schema",
    SCHEMA_URI,
    { description: "Text schema for the demo sales database", mimeType: "text/plain" },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: await readFile(
            path.join(process.cwd(), "src/app/services/resources/database-schema.txt"),
            "utf8",
          ),
        },
      ],
    }),
  );

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
        const resource = await mcpClient.readResource({ uri: SCHEMA_URI });
        const schema = resource.contents
          .filter((content): content is typeof content & { text: string } => "text" in content)
          .map((content) => content.text)
          .join("\n");
        options.onSqlStart?.();
        let sqlText = "";
        const stream = await model.stream([
          {
            role: "system",
            content: prompts.sqlGeneration,
          },
          { role: "user", content: formatSqlRequest(prompts.sqlRequest, schema, naturalLanguage) },
        ], { signal: options.signal, tags: ["sql-generation"] });
        for await (const chunk of stream) {
          const token = extractText(chunk.content);
          sqlText += token;
          if (token) options.onToken?.(token);
        }
        const validated = cleanAndValidateSql(sqlText);
        context.generatedSQL = validated.sql;
        context.requiredTables = validated.tables;
        console.debug("Generated SQL:", validated.sql);
        console.debug("Generated requird tables", validated.tables)
      })().catch((error: unknown) => {
        context.toolError = error instanceof Error ? error : new Error(String(error));
        throw context.toolError;
      });
      await context.sqlGeneration;
      return { content: [{ type: "text", text: JSON.stringify({ sql: context.generatedSQL, tables: context.requiredTables }) }] };
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
      const validated = cleanAndValidateSql(query);
      if (!context.generatedSQL || validated.sql !== context.generatedSQL) {
        throw new Error("Execute exactly the SQL returned by construct_sql.");
      }
      console.debug("Executing SQL:", validated.sql);
      context.queryExecution ??= executeDatabaseQuery(validated.sql, context.options.signal).catch((error: unknown) => {
        context.toolError = error instanceof Error ? error : new Error(String(error));
        throw context.toolError;
      });
      context.queryResult = await context.queryExecution;
      return { content: [{ type: "text", text: JSON.stringify(context.queryResult) }] };
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
