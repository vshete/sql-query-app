import type { DatabaseQueryResult, QueryAgentResult } from "../types/query.types";
import { executeDatabaseQuery } from "./database";
import { cleanAndValidateSql } from "./sqlValidation";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { createAgent } from "langchain";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

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
  model: ChatGoogleGenerativeAI | ChatOpenAI;
  options: QueryAgentOptions;
  generatedSQL: string;
  requiredTables: string[];
  queryResult?: DatabaseQueryResult;
}

const requestContexts = new Map<string, QueryRequestContext>();
let mcpInitialization: Promise<Client> | undefined;

function getRequestContext(requestId: string): QueryRequestContext {
  const context = requestContexts.get(requestId);
  if (!context) throw new Error("Query request is no longer active.");
  return context;
}

async function initializeMcpServer(): Promise<Client> {
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
      description: "Read the database-schema MCP resource and construct one read-only SQL query for the user's request.",
      inputSchema: { request: z.string(), requestId: z.string() },
    },
    async ({ request: naturalLanguage, requestId }) => {
      const context = getRequestContext(requestId);
      const { model, options } = context;
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
          content: "Generate one PostgreSQL SELECT query using only tables and columns in the provided schema. Never modify data or schema. Return only SQL, without markdown or explanation.",
        },
        { role: "user", content: `Schema:\n${schema}\n\nRequest: ${naturalLanguage}` },
      ], { signal: options.signal, tags: ["sql-generation"] });
      for await (const chunk of stream) {
        const token = extractText(chunk.content);
        sqlText += token;
        if (token) options.onToken?.(token);
      }
      const validated = cleanAndValidateSql(sqlText);
      context.generatedSQL = validated.sql;
      context.requiredTables = validated.tables;
      return { content: [{ type: "text", text: JSON.stringify({ sql: context.generatedSQL, tables: context.requiredTables }) }] };
    },
  );

  mcpServer.registerTool(
    "execute_query",
    {
      description: "Execute a validated read-only query against PostgreSQL and return actual database rows.",
      inputSchema: { query: z.string(), requestId: z.string() },
    },
    async ({ query, requestId }) => {
      const context = getRequestContext(requestId);
      const validated = cleanAndValidateSql(query);
      if (!context.generatedSQL || validated.sql !== context.generatedSQL) {
        throw new Error("Execute exactly the SQL returned by construct_sql.");
      }
      context.queryResult = await executeDatabaseQuery(validated.sql, context.options.signal);
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

function getMcpClient(): Promise<Client> {
  // Share initialization across concurrent requests; allow a retry if it fails.
  mcpInitialization ??= initializeMcpServer().catch((error) => {
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
  const model = provider === "gemini"
    ? new ChatGoogleGenerativeAI({ apiKey, model: modelName, temperature: 0, streaming: true })
    : new ChatOpenAI({ apiKey, model: modelName, temperature: 0, streaming: true });
  const mcpClient = await getMcpClient();
  const requestId = randomUUID();
  const context: QueryRequestContext = {
    model, options, generatedSQL: "", requiredTables: [],
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
        description: "Create a safe SQL SELECT from the user's request using the database schema resource.",
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
        description: "Run the generated read-only SQL against PostgreSQL and return actual results.",
        schema: z.object({ query: z.string() }),
      },
    );

    const agent = createAgent({
      model,
      tools: [constructSqlTool, executeQueryTool],
      systemPrompt: "You are a SQL query agent. For each request, call construct_sql first, then call execute_query with exactly the SQL it returned. Do not answer until both tools have been called. Never invent tool results.",
    });
    
    const events = agent.streamEvents(
      { messages: [{ role: "user", content: request }] },
      { version: "v2", signal: options.signal },
    );
    for await (const event of events) {
      // SQL has its own channel; agent text must not be appended to the SQL editor.
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
      confidence: 0.9,
      explanation: "Generated using the MCP schema resource and executed against PostgreSQL.",
      requiredTables,
      warnings: queryResult.truncated ? ["Results are limited to the first 1,000 rows."] : [],
      queryResult,
    };
  } finally {
    requestContexts.delete(requestId);
  }
}