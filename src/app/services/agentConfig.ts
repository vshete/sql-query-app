import type { QueryAgentProvider } from './queryAgent';

export function getAgentConfig() {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  if (provider !== 'gemini' && provider !== 'openai') {
    throw new Error('AI_PROVIDER must be gemini or openai.');
  }
  const apiKey = provider === 'gemini'
    ? process.env.AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    : process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) throw new Error(`Set ${provider === 'gemini' ? 'AI_API_KEY' : 'OPENAI_API_KEY'} in your .env file.`);
  return {
    provider: provider as QueryAgentProvider,
    apiKey,
    model: process.env.AI_MODEL || process.env.LANGCHAIN_MODEL
      || (provider === 'gemini' ? 'gemini-3.5-flash' : 'gpt-4o-mini'),
  };
}
