import type { QueryAgentResult, QueryChatMessage } from "../types/query.types";
import {
  MAX_HISTORY_LENGTH,
  MAX_HISTORY_MESSAGES,
} from "../types/queryProtocol";

/** Keep complete, recent question/answer pairs within the model context budget. */
export function appendQueryHistory(
  history: QueryChatMessage[],
  request: string,
  result: QueryAgentResult,
): QueryChatMessage[] {
  const summary = {
    explanation: result.explanation,
    sql: result.generatedSQL,
    columns: result.queryResult.columns,
    rowCount: result.queryResult.rowCount,
    truncated: result.queryResult.truncated,
    sampleRows: result.queryResult.rows.slice(0, 20),
    sampleOnly: true,
  };

  // Very wide rows must not crowd SQL and conversation out of context.
  while (JSON.stringify(summary).length > 20_000 && summary.sampleRows.length)
    summary.sampleRows.pop();
  const next: QueryChatMessage[] = [
    ...history,
    { role: "user", content: request },
    { role: "assistant", content: JSON.stringify(summary) },
  ];
  while (
    next.length > MAX_HISTORY_MESSAGES ||
    next.reduce((total, message) => total + message.content.length, 0) >
      MAX_HISTORY_LENGTH
  )
    next.splice(0, 2);
  return next;
}

export function parseQueryHistory(value: unknown): QueryChatMessage[] {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length > MAX_HISTORY_MESSAGES ||
    value.length % 2
  )
    throw new Error(
      "Either Invalid conversation history or exceeds maximum history length.",
    );
  let length = 0;
  const messages = value.map((message, index) => {
    if (
      !message ||
      typeof message !== "object" ||
      message.role !== (index % 2 === 0 ? "user" : "assistant") ||
      typeof message.content !== "string" ||
      !message.content.trim()
    )
      throw new Error("Invalid conversation history.");
    length += message.content.length;
    return { role: message.role, content: message.content } as QueryChatMessage;
  });
  if (length > MAX_HISTORY_LENGTH)
    throw new Error("Conversation history is too large.");
  return messages;
}
