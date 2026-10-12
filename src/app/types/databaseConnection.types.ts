import type { SchemaTable } from "../services/databaseSchema";

export interface ConnectionInfo {
  connected: boolean;
  label?: string;
  tableCount?: number;
  tables?: SchemaTable[];
}
