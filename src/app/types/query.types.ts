export interface MockQueryResult {
  columns: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
  rowCount: number;
  scenario: string;
  message: string;
}

export interface QueryAgentResult {
  generatedSQL: string;
  confidence: number;
  explanation: string;
  requiredTables: string[];
  warnings: string[];
  mockResult: MockQueryResult;
}
