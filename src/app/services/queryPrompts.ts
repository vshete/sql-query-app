import { readFile } from "node:fs/promises";
import path from "node:path";

const promptFiles = {
  queryAgent: "query-agent.md",
  sqlGeneration: "sql-generation.md",
  sqlRequest: "sql-request.md",
  constructSql: "construct-sql.md",
  executeQuery: "execute-query.md",
  mcpConstructSql: "mcp-construct-sql.md",
  mcpExecuteQuery: "mcp-execute-query.md",
  mcpSummarizeResults: "mcp-summarize-results.md",
  resultSummary: "result-summary.md",
} as const;

export type QueryPrompts = Record<keyof typeof promptFiles, string>;

export async function loadQueryPrompts(): Promise<QueryPrompts> {
  const entries = await Promise.all(
    Object.entries(promptFiles).map(async ([key, filename]) => {
      const content = await readFile(
        path.join(process.cwd(), "src/app/services/prompts", filename),
        "utf8",
      );
      if (!content.trim()) throw new Error(`AI prompt file is empty: ${filename}`);
      return [key, content.trim()] as const;
    }),
  );
  return Object.fromEntries(entries) as QueryPrompts;
}

export function formatSqlRequest(template: string, schema: string, request: string): string {
  // Replace in one pass so placeholders inside schema or user input stay literal.
  return template.replace(/\{\{(schema|request)\}\}/g, (_, key: string) =>
    key === "schema" ? schema : request,
  );
}
