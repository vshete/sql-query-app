import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { MockQueryChatModel } from './mockQueryChatModel';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import type { QueryAgentProvider } from '../queryAgent';

export { MOCK_SQL } from './mockQueryChatModel';

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
    apiKey: config.apiKey, model: config.modelName,
    temperature: 0, streaming: true, maxRetries: 0,
  };
  return config.provider === 'gemini'
    ? new ChatGoogleGenerativeAI(options)
    : new ChatOpenAI(options);
}
