import { z } from "zod";

const requestInput = z.object({
  request: z
    .string()
    .min(1)
    .describe("The user's natural language database question"),
});

const queryInput = z.object({
  query: z
    .string()
    .min(1)
    .describe("Exactly the SQL returned by construct_sql"),
});

const queryValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

// Shared by MCP registration and the LangChain bridge; requestId stays application-owned.
export const queryToolContracts = {
  construct_sql: {
    name: "construct_sql",
    title: "Generate SQL",
    input: requestInput,
    output: z.object({ sql: z.string().min(1), tables: z.array(z.string()) }),
  },
  execute_query: {
    name: "execute_query",
    title: "Run database query",
    input: queryInput,
    output: z.object({
      columns: z.array(z.string()),
      rows: z.array(z.record(z.string(), queryValue)),
      rowCount: z.number().int().nonnegative(),
      truncated: z.boolean(),
      message: z.string(),
    }),
  },
  summarize_results: {
    name: "summarize_results",
    title: "Summarize query results",
    input: requestInput,
    output: z.object({ explanation: z.string() }),
  },
} as const;

export type QueryToolName = keyof typeof queryToolContracts;
