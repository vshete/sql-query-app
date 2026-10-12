export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
}

export interface SchemaTable {
  schema: string;
  name: string;
  columns: SchemaColumn[];
  constraints: string[];
}
