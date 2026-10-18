import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import type { QueryAgentProvider } from "./queryAgent";
import { MockQueryChatModel } from "./mocks/mockQueryChatModel";

export { MOCK_SQL } from "./mocks/mockQueryChatModel";

/** Construct a deterministic mock or a streaming provider model with automatic retries disabled. */
export function createQueryModel(config: {
  provider: QueryAgentProvider;
  apiKey: string;
  modelName: string;
  mockModel: boolean;
  request: string;
}): BaseChatModel {
  if (config.mockModel) {
    return new MockQueryChatModel(config.request);
  }
  const options = {
    apiKey: config.apiKey,
    model: config.modelName,
    temperature: 0,
    streaming: true,
    maxRetries: 0,
  };
  return config.provider === "gemini"
    ? new ChatGoogleGenerativeAI(options)
    : new ChatOpenAI(options);
}
