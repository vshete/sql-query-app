import { tool } from "@langchain/core/tools";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { AGENT_TIMEOUT_MS } from "../types/queryProtocol";
import type { QueryRequestContext } from "./queryAgent.types";
import { queryToolContracts, type QueryToolName } from "./queryToolContracts";

type ToolOutput<Name extends QueryToolName> = z.output<
  (typeof queryToolContracts)[Name]["output"]
>;

/** Call MCP with application-owned request identity and validate the returned tool-specific payload. */
export async function callQueryTool<Name extends QueryToolName>(
  client: Client,
  name: Name,
  args: z.input<(typeof queryToolContracts)[Name]["input"]>,
  requestId: string,
  signal?: AbortSignal,
): Promise<ToolOutput<Name>> {
  signal?.throwIfAborted();
  const result = CallToolResultSchema.parse(
    await client.callTool(
      { name, arguments: { ...args, requestId } },
      undefined,
      { signal, timeout: AGENT_TIMEOUT_MS },
    ),
  );

  if (result.isError) {
    const message = result.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n");
    throw new Error(message || "MCP tool call failed");
  }

  return queryToolContracts[name].output.parse(
    result.structuredContent,
  ) as ToolOutput<Name>;
}

/** Expose generation and execution to LangChain while retaining results in the request context. */
export function createQueryAgentTools(
  client: Client,
  requestId: string,
  context: QueryRequestContext,
) {
  const generate = queryToolContracts.construct_sql;
  const execute = queryToolContracts.execute_query;

  return [
    tool(
      async (args) => {
        const output = await callQueryTool(
          client,
          generate.name,
          args,
          requestId,
          context.options.signal,
        );
        context.generatedSQL = output.sql;
        return output.sql;
      },
      {
        name: generate.name,
        description: context.prompts.constructSql,
        schema: generate.input,
      },
    ),
    tool(
      async (args) => {
        context.queryResult = await callQueryTool(
          client,
          execute.name,
          args,
          requestId,
          context.options.signal,
        );
        return JSON.stringify(context.queryResult);
      },
      {
        name: execute.name,
        description: context.prompts.executeQuery,
        schema: execute.input,
      },
    ),
  ];
}
