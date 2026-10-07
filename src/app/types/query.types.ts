export interface DatabaseQueryResult {
  columns: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
  rowCount: number;
  truncated: boolean;
  message: string;
}

export interface QueryAgentResult {
  generatedSQL: string;
  confidence: number;
  explanation: string;
  requiredTables: string[];
  warnings: string[];
  queryResult: DatabaseQueryResult;
}
