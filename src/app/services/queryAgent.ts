import type { DatabaseQueryResult, QueryAgentResult } from "../types/query.types";
import { randomUUID } from "node:crypto";
import { createQueryModel } from "./mocks/modelFactory";
import { isMockModelEnabled } from "./mocks/mockMode";
import { tool } from "@langchain/core/tools";
import { createAgent } from "langchain";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { z } from "zod";
import { loadQueryPrompts, type QueryPrompts } from "./queryPrompts";
import { initializeMcpServer, QueryAgentOptions, QueryRequestContext, requestContexts } from "./queryAgentMCP";



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



let mcpInitialization: Promise<Client> | undefined;

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
