export type QueryValue = string | number | boolean | null;
export type QueryRow = Record<string, QueryValue>;

export interface DatabaseQueryResult {
  columns: string[];
  rows: QueryRow[];
  rowCount: number;
  truncated: boolean;
  message: string;
}

export interface QueryAgentResult {
  generatedSQL: string;
  explanation: string;
  requiredTables: string[];
  warnings: string[];
  queryResult: DatabaseQueryResult;
}

export interface QueryChatMessage {
  role: "user" | "assistant";
  content: string;
}
