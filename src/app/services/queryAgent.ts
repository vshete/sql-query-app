import { createAgent } from "langchain";
import type { QueryAgentResult } from "../types/query.types";
import { isMockModelEnabled } from "./mocks/mockMode";
import { createQueryModel } from "./mocks/modelFactory";
import type {
  QueryAgentOptions,
  QueryRequestContext,
} from "./queryAgent.types";
import { getQueryMcpClient } from "./queryAgentMCP";
import { createQueryAgentMiddleware } from "./queryAgentMiddleware";
import { callQueryTool, createQueryAgentTools } from "./queryAgentTools";
import { parseQueryHistory } from "./queryConversation";
import { extractText, toHistoryMessages } from "./queryMessages";
import { loadQueryPrompts } from "./queryPrompts";
import { registerQueryRequest } from "./queryRequestStore";

export type QueryAgentProvider = "gemini" | "openai";

export async function runQueryAgent(
  request: string,
  provider: QueryAgentProvider,
  apiKey: string,
  modelName: string,
  options: QueryAgentOptions = {},
): Promise<QueryAgentResult> {
  options = { ...options, history: parseQueryHistory(options.history) };
  const mockModel = isMockModelEnabled();
  const model = createQueryModel({
    provider,
    apiKey,
    modelName,
    mockModel,
    request,
  });
  const prompts = await loadQueryPrompts();
  const mcpClient = await getQueryMcpClient(prompts);
  const context: QueryRequestContext = {
    model,
    prompts,
    options,
    modelCalls: 0,
    generatedSQL: "",
    requiredTables: [],
  };

  const { requestId, dispose } = registerQueryRequest(context);

  try {
    let agentText = "";
    try {
      const agent = createAgent({
        model,
        middleware: [createQueryAgentMiddleware(context)],
        tools: createQueryAgentTools(mcpClient, requestId, context),
        systemPrompt: prompts.queryAgent,
      });
      const events = agent.streamEvents(
        {
          messages: [
            ...toHistoryMessages(options.history),
            { role: "user", content: request },
          ],
        },
        { version: "v2", signal: options.signal },
      );

      for await (const event of events) {
        // SQL streams separately so agent text never enters the SQL editor.
        if (
          event.event === "on_chat_model_stream" &&
          !event.tags?.includes("sql-generation")
        ) {
          const token = extractText(event.data.chunk?.content);
          if (token) {
            agentText += token;
            options.onAgentToken?.(token);
          }
        }
      }
    } catch (error) {
      if (options.signal?.aborted) throw options.signal.reason;
      console.error("Query agent failed:", error);
      throw error;
    }

    const { generatedSQL, requiredTables, queryResult } = context;
    if (generatedSQL && !queryResult) {
      throw new Error(
        "The query agent generated SQL but did not execute it.",
      );
    }

    if (!queryResult) {
      if (!agentText.trim()) throw new Error("The query agent returned no answer.");
      return {
        generatedSQL: "",
        explanation: agentText.trim(),
        requiredTables: [],
        warnings: [],
      };
    }

    const result: QueryAgentResult = {
      generatedSQL,
      explanation: mockModel
        ? "Generated using a mock model and executed against PostgreSQL."
        : "Generated using the connected database schema and executed against PostgreSQL.",
      requiredTables,
      warnings: queryResult.truncated
        ? ["Results are limited to the first 1,000 rows."]
        : [],
      queryResult,
    };

    if (options.summarizeResults) {
      try {
        const { explanation } = await callQueryTool(
          mcpClient,
          "summarize_results",
          { request },
          requestId,
          options.signal,
        );
        if (explanation.trim()) result.explanation = explanation.trim();
      } catch (error) {
        if (options.signal?.aborted) throw error;
        // A failed optional explanation must not discard a successfully executed table.
        result.warnings.push(
          "The text summary could not be generated. The query results are available below.",
        );
      }
    }
    return result;
  } finally {
    dispose();
  }
}
