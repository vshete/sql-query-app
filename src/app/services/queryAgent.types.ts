import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { Sequelize } from "sequelize";
import type {
  DatabaseQueryResult,
  QueryChatMessage,
} from "../types/query.types";
import type { QueryPrompts } from "./queryPrompts";

export interface QueryAgentOptions {
  history?: QueryChatMessage[];
  summarizeResults?: boolean;
  onToken?: (token: string) => void;
  onAgentToken?: (token: string) => void;
  onSqlStart?: () => void;
  signal?: AbortSignal;
  database?: Sequelize;
}

export interface QueryRequestContext {
  model: BaseChatModel;
  prompts: QueryPrompts;
  options: QueryAgentOptions;
  modelCalls: number;
  generatedSQL: string;
  requiredTables: string[];
  allowedTables?: Set<string>;
  queryResult?: DatabaseQueryResult;
  toolError?: Error;
  sqlGeneration?: Promise<void>;
  queryExecution?: Promise<DatabaseQueryResult>;
  resultSummary?: Promise<string>;
}
