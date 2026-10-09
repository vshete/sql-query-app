import type { DatabaseQueryResult, QueryAgentResult } from "../types/query.types";
import { executeDatabaseQuery } from "./database";
import { cleanAndValidateSql } from "./sqlValidation";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { createQueryModel } from "./mocks/modelFactory";
import { isMockModelEnabled } from "./mocks/mockMode";
import { tool } from "@langchain/core/tools";
import { createAgent } from "langchain";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadQueryPrompts, formatSqlRequest, type QueryPrompts } from "./queryPrompts";

const SCHEMA_URI = "postgres://database/schema";


function extractText(content: unknown): string {
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

function parseToolText(result: unknown): string {
  if (typeof result !== "object" || result === null || !("content" in result) || !Array.isArray(result.content)) {
    throw new Error("MCP tool returned an unsupported result.");
  }
  const toolResult = result as { content: Array<{ type?: string; text?: string }>; isError?: boolean };
  const text = toolResult.content
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("\n");
  if (toolResult.isError) throw new Error(text || "MCP tool call failed");
  return text;
}


export type QueryAgentProvider = "gemini" | "openai";

interface QueryAgentOptions {
  onToken?: (token: string) => void;
  onAgentToken?: (token: string) => void;
  onSqlStart?: () => void;
  signal?: AbortSignal;
}

interface QueryRequestContext {
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

const requestContexts = new Map<string, QueryRequestContext>();
let mcpInitialization: Promise<Client> | undefined;

function getRequestContext(requestId: string): QueryRequestContext {
  const context = requestContexts.get(requestId);
  if (!context) throw new Error("Query request is no longer active.");
  return context;
}

async function initializeMcpServer(prompts: QueryPrompts): Promise<Client> {
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

function getMcpClient(prompts: QueryPrompts): Promise<Client> {
  // Share initialization across concurrent requests; allow a retry if it fails.
  mcpInitialization ??= initializeMcpServer(prompts).catch((error) => {
    mcpInitialization = undefined;
    throw error;
  });
  return mcpInitialization;
}

export async function runQueryAgent(
  request: string,
  provider: QueryAgentProvider,
  apiKey: string,
  modelName: string,
  options: QueryAgentOptions = {},
): Promise<QueryAgentResult> {
  const mockModel = isMockModelEnabled();
  const model = createQueryModel({ provider, apiKey, modelName, mockModel, request });
  const prompts = await loadQueryPrompts();
  const mcpClient = await getMcpClient(prompts);
  const requestId = randomUUID();
  const context: QueryRequestContext = {
    model, prompts, options, generatedSQL: "", requiredTables: [],
  };
  requestContexts.set(requestId, context);

  try {
    const constructSqlTool = tool(
      async ({ request: naturalLanguage }) => {
        const result = await mcpClient.callTool({
          name: "construct_sql",
          arguments: { request: naturalLanguage, requestId },
        });
        const parsed = JSON.parse(parseToolText(result)) as { sql: string };
        context.generatedSQL = parsed.sql;
        return parsed.sql;
      },
      {
        name: "construct_sql",
        description: prompts.constructSql,
        schema: z.object({ request: z.string() }),
      },
    );

    const executeQueryTool = tool(
      async ({ query }) => {
        const start = performance.now();
        console.debug("Executing PostgreSQL query: ", query);
        const result = await mcpClient.callTool({
          name: "execute_query",
          arguments: { query, requestId },
        });
        console.debug("PostgreSQL query result: ", result);
        context.queryResult = JSON.parse(parseToolText(result)) as DatabaseQueryResult;
        const end = performance.now();
        console.debug("PostgreSQL query execution time: ", end - start);
        return JSON.stringify(context.queryResult);
      },
      {
        name: "execute_query",
        description: prompts.executeQuery,
        schema: z.object({ query: z.string() }),
      },
    );

    const agent = createAgent({
      model,
      tools: [constructSqlTool, executeQueryTool],
      systemPrompt: prompts.queryAgent,
    });
    const events = agent.streamEvents(
      { messages: [{ role: "user", content: request }] },
      { version: "v2", signal: options.signal },
    );
    for await (const event of events) {
      // SQL streams separately so agent text never enters the SQL editor.
      if (event.event === "on_chat_model_stream" && !event.tags?.includes("sql-generation")) {
        const token = extractText(event.data.chunk?.content);
        if (token) options.onAgentToken?.(token);
      }
    }

    const { generatedSQL, requiredTables, queryResult } = context;
    if (!generatedSQL || !queryResult) {
      throw new Error("The query agent did not complete both required tool calls.");
    }

    return {
      generatedSQL,
      explanation: mockModel
        ? "Generated using a mock model and executed against PostgreSQL."
        : "Generated using the MCP schema resource and executed against PostgreSQL.",
      requiredTables,
      warnings: queryResult.truncated ? ["Results are limited to the first 1,000 rows."] : [],
      queryResult,
    };
  } finally {
    requestContexts.delete(requestId);
  }
}
