import type { MockQueryResult, QueryAgentResult } from "../types/query.types";
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

const SCHEMA_URI = "demo://database/schema";


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


function emptyResult(message: string, scenario = "empty-result"): MockQueryResult {
  return { columns: [], rows: [], rowCount: 0, scenario, message };
}

function getMockDatabaseResponse(sql: string): MockQueryResult {
  const normalizedSql = sql.toLowerCase();

  if (normalizedSql.includes("mock_db_error")) {
    return emptyResult("The mock database returned a simulated connection error.", "database-error");
  }
  if (/\b1\s*=\s*0\b|\bfalse\b|no_such_match/.test(normalizedSql)) {
    return emptyResult("The query ran successfully but matched no rows.");
  }

  if (/\bfrom\s+["`]?products\b/.test(normalizedSql)) {
    if (/\bcount\s*\(/.test(normalizedSql)) {
      return {
        columns: ["product_count"],
        rows: [{ product_count: 77 }],
        rowCount: 1,
        scenario: "aggregate",
        message: "Mock count of products.",
      };
    }
    return {
      columns: ["product_id", "product_name", "category_id", "unit_price", "units_in_stock", "discontinued"],
      rows: [
        { product_id: 1, product_name: "Chai", category_id: 1, unit_price: 18, units_in_stock: 39, discontinued: false },
        { product_id: 2, product_name: "Chang", category_id: 1, unit_price: 19, units_in_stock: 17, discontinued: false },
        { product_id: 3, product_name: "Aniseed Syrup", category_id: 2, unit_price: 10, units_in_stock: 13, discontinued: false },
      ],
      rowCount: 3,
      scenario: "products",
      message: "Representative product rows returned by the mock database.",
    };
  }

  if (/\bfrom\s+["`]?orders\b/.test(normalizedSql)) {
    if (/\bcount\s*\(/.test(normalizedSql) || /\bgroup\s+by\b/.test(normalizedSql)) {
      return {
        columns: ["country", "order_count", "total_freight"],
        rows: [
          { country: "USA", order_count: 122, total_freight: 1894.4 },
          { country: "Germany", order_count: 122, total_freight: 1623.17 },
          { country: "Brazil", order_count: 83, total_freight: 1270.92 },
        ],
        rowCount: 3,
        scenario: "order-aggregate",
        message: "Mock grouped order totals by customer country.",
      };
    }
    return {
      columns: ["order_id", "customer_id", "employee_id", "order_date", "freight"],
      rows: [
        { order_id: 10248, customer_id: "VINET", employee_id: 5, order_date: "1996-07-04", freight: 32.38 },
        { order_id: 10249, customer_id: "TOMSP", employee_id: 6, order_date: "1996-07-05", freight: 11.61 },
        { order_id: 10250, customer_id: "HANAR", employee_id: 4, order_date: "1996-07-08", freight: 65.83 },
      ],
      rowCount: 3,
      scenario: "orders",
      message: "Representative order rows returned by the mock database.",
    };
  }

  if (/\bfrom\s+["`]?customers\b/.test(normalizedSql)) {
    if (/\bcount\s*\(/.test(normalizedSql)) {
      return {
        columns: ["customer_count"],
        rows: [{ customer_count: 91 }],
        rowCount: 1,
        scenario: "aggregate",
        message: "Mock count of customers.",
      };
    }
    return {
      columns: ["customer_id", "company_name", "contact_name", "city", "country"],
      rows: [
        { customer_id: "ALFKI", company_name: "Alfreds Futterkiste", contact_name: "Maria Anders", city: "Berlin", country: "Germany" },
        { customer_id: "ANATR", company_name: "Ana Trujillo Emparedados", contact_name: "Ana Trujillo", city: "Mexico City", country: "Mexico" },
        { customer_id: "ANTON", company_name: "Antonio Moreno Taqueria", contact_name: "Antonio Moreno", city: "Mexico City", country: "Mexico" },
      ],
      rowCount: 3,
      scenario: "customers",
      message: "Representative customer rows returned by the mock database.",
    };
  }

  if (/\bfrom\s+["`]?employees\b/.test(normalizedSql)) {
    return {
      columns: ["employee_id", "first_name", "last_name", "title", "country"],
      rows: [
        { employee_id: 1, first_name: "Nancy", last_name: "Davolio", title: "Sales Representative", country: "USA" },
        { employee_id: 2, first_name: "Andrew", last_name: "Fuller", title: "Vice President Sales", country: "USA" },
      ],
      rowCount: 2,
      scenario: "employees",
      message: "Representative employee rows returned by the mock database.",
    };
  }

  if (/\bfrom\s+["`]?categories\b/.test(normalizedSql)) {
    return {
      columns: ["category_id", "category_name", "description"],
      rows: [
        { category_id: 1, category_name: "Beverages", description: "Soft drinks, coffees, teas, beers, and ales" },
        { category_id: 2, category_name: "Condiments", description: "Sweet and savory sauces, relishes, and seasonings" },
      ],
      rowCount: 2,
      scenario: "categories",
      message: "Representative category rows returned by the mock database.",
    };
  }

  return {
    columns: ["order_id", "product_id", "unit_price", "quantity", "discount"],
    rows: [
      { order_id: 10248, product_id: 11, unit_price: 14, quantity: 12, discount: 0 },
      { order_id: 10248, product_id: 42, unit_price: 9.8, quantity: 10, discount: 0 },
    ],
    rowCount: 2,
    scenario: "order-details",
    message: "Representative order detail rows returned by the mock database.",
  };
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
  mockResult?: MockQueryResult;
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
    "execute_mock_query",
    {
      description: "Execute a validated read-only query against the deterministic demo mock database; this never connects to a real database.",
      inputSchema: { query: z.string(), requestId: z.string() },
    },
    async ({ query, requestId }) => {
      const context = getRequestContext(requestId);
      const validated = cleanAndValidateSql(query);
      context.mockResult = getMockDatabaseResponse(validated.sql);
      return { content: [{ type: "text", text: JSON.stringify(context.mockResult) }] };
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
        console.debug("Executing mock query to fetch results: ", query);
        const result = await mcpClient.callTool({
          name: "execute_mock_query",
          arguments: { query, requestId },
        });
        console.debug("Raw mock query result: ", result);
        context.mockResult = JSON.parse(parseToolText(result)) as MockQueryResult;
        const end = performance.now();
        console.debug("Mock query execution time: ", end - start);
        return JSON.stringify(context.mockResult);
      },
      {
        name: "execute_mock_query",
        description: "Run the generated read-only SQL using the mock database tool and return representative results.",
        schema: z.object({ query: z.string() }),
      },
    );

    const agent = createAgent({
      model,
      tools: [constructSqlTool, executeQueryTool],
      systemPrompt: "You are a SQL query agent. For each request, call construct_sql first, then call execute_mock_query with exactly the SQL it returned. Do not answer until both tools have been called. Never invent tool results.",
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

    const { generatedSQL, requiredTables, mockResult } = context;
    if (!generatedSQL || !mockResult) {
      throw new Error("The query agent did not complete both required tool calls.");
    }
    return {
      generatedSQL,
      confidence: 0.9,
      explanation: "Generated using the MCP schema resource and executed against the mock database.",
      requiredTables,
      warnings: ["Results are demonstrations from a mock database; no live database was queried."],
      mockResult,
    };
  } finally {
    requestContexts.delete(requestId);
  }
}