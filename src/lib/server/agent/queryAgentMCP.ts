import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { executeQuery } from "./executeQuery";
import { generateSql } from "./generateSql";
import type { QueryRequestContext } from "./queryAgent.types";
import type { QueryPrompts } from "./queryPrompts";
import { getQueryRequest } from "./queryRequestStore";
import { queryToolContracts } from "./queryToolContracts";
import { summarizeResults } from "./summarizeResults";

export interface QueryMcpConnection {
  client: Client;
  close: () => Promise<void>;
}

// MCP cancellation (including timeout) and browser cancellation must both stop work.
function toolSignal(context: QueryRequestContext, signal: AbortSignal) {
  return context.options.signal
    ? AbortSignal.any([context.options.signal, signal])
    : signal;
}

/** Register validated tools on a linked in-memory MCP client/server pair; close both on setup failure. */
export async function createQueryMcpConnection(
  prompts: QueryPrompts,
): Promise<QueryMcpConnection> {
  const server = new McpServer({ name: "query-app", version: "1.0.0" });
  const client = new Client({ name: "query-app-agent", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  // Tool schemas extend the model-facing contract with an internal context lookup ID.
  const requestId = z.string().uuid();

  const generate = queryToolContracts.construct_sql;
  server.registerTool(
    generate.name,
    {
      title: generate.title,
      description: prompts.mcpConstructSql,
      inputSchema: generate.input.extend({ requestId }),
      outputSchema: generate.output,
    },
    async ({ request, requestId }, extra) => {
      const context = getQueryRequest(requestId);
      const output = generate.output.parse(
        await generateSql(context, request, toolSignal(context, extra.signal)),
      );
      return {
        structuredContent: output,
        content: [{ type: "text", text: JSON.stringify(output) }],
      };
    },
  );

  const execute = queryToolContracts.execute_query;
  server.registerTool(
    execute.name,
    {
      title: execute.title,
      description: prompts.mcpExecuteQuery,
      inputSchema: execute.input.extend({ requestId }),
      outputSchema: execute.output,
    },
    async ({ query, requestId }, extra) => {
      const context = getQueryRequest(requestId);
      const output = execute.output.parse(
        await executeQuery(context, query, toolSignal(context, extra.signal)),
      );
      return {
        structuredContent: output,
        content: [{ type: "text", text: JSON.stringify(output) }],
      };
    },
  );

  const summarize = queryToolContracts.summarize_results;
  server.registerTool(
    summarize.name,
    {
      title: summarize.title,
      description: prompts.mcpSummarizeResults,
      inputSchema: summarize.input.extend({ requestId }),
      outputSchema: summarize.output,
    },
    async ({ request, requestId }, extra) => {
      const context = getQueryRequest(requestId);
      const output = summarize.output.parse(
        await summarizeResults(
          context,
          request,
          toolSignal(context, extra.signal),
        ),
      );
      return {
        structuredContent: output,
        content: [{ type: "text", text: JSON.stringify(output) }],
      };
    },
  );

  const close = async () => {
    await Promise.allSettled([client.close(), server.close()]);
  };
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return { client, close };
  } catch (error) {
    await close();
    throw error;
  }
}

// One transport pair serves concurrent turns; request IDs isolate their mutable contexts.
// Descriptions are captured from the prompts used to create the first successful connection.
let connection: Promise<QueryMcpConnection> | undefined;

/** Share the first connection promise across callers; allow a retry if connection setup fails. */
export async function getQueryMcpClient(
  prompts: QueryPrompts,
): Promise<Client> {
  connection ??= createQueryMcpConnection(prompts).catch((error) => {
    connection = undefined;
    throw error;
  });
  return (await connection).client;
}

/** Call during application shutdown or test teardown, after active queries settle. */
export async function closeQueryMcpConnection() {
  const current = connection;
  connection = undefined;
  if (current) await (await current).close();
}
