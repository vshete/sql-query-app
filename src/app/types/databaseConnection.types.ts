import type { SchemaTable } from "./databaseSchema.types";

export interface ConnectionInfo {
  connected: boolean;
  label?: string;
  tableCount?: number;
  tables?: SchemaTable[];
}
