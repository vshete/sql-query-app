import { AIMessage, HumanMessage } from "@langchain/core/messages";
import type { QueryChatMessage } from "../types/query.types";

export function toHistoryMessages(history: QueryChatMessage[] = []) {
  return history.map((message) =>
    message.role === "user"
      ? new HumanMessage(message.content)
      : new AIMessage(message.content),
  );
}

export function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "object" && part !== null && "text" in part
          ? String(part.text)
          : "",
      )
      .join("");
  }
  return "";
}
