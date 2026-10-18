import { AIMessage, HumanMessage } from "@langchain/core/messages";
import type { QueryChatMessage } from "../types/query.types";

/** Translate validated conversation entries into LangChain user and assistant messages. */
export function toHistoryMessages(history: QueryChatMessage[] = []) {
  return history.map((message) =>
    message.role === "user"
      ? new HumanMessage(message.content)
      : new AIMessage(message.content),
  );
}

/** Flatten supported model text blocks, ignoring non-text content such as tool calls. */
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
