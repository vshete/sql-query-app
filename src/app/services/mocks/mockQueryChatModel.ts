import { randomUUID } from 'node:crypto';
import { AIMessageChunk } from '@langchain/core/messages';
import { FakeListChatModel, FakeStreamingChatModel } from '@langchain/core/utils/testing';

export const MOCK_SQL = 'SELECT customer_id, company_name, country FROM customers ORDER BY customer_id LIMIT 25;';
export const MOCK_SQL_CHUNK_DELAY_MS = 35;
export const MOCK_SUMMARY = 'This is a dummy summary of the tabulated query results. Review the table for the returned customer records.';

// Unbound calls generate SQL, then a dummy summary; bound calls return tool calls.
// LangChain remains responsible for dispatching tools and advancing the agent.
export class MockQueryChatModel extends FakeListChatModel {
  constructor(private readonly request: string) {
    // FakeListChatModel streams one character per chunk; pace those chunks to
    // make SQL generation visibly progressive (about three seconds in total).
    super({ responses: [MOCK_SQL, MOCK_SUMMARY], sleep: MOCK_SQL_CHUNK_DELAY_MS });
  }

  override bindTools(tools: Parameters<FakeListChatModel['bindTools']>[0]) {
    const selected = tools.find((tool) => tool.name === 'construct_sql')
      ?? tools.find((tool) => tool.name === 'execute_query');
    if (!selected) throw new Error('Mock model requires a query tool.');

    return new FakeStreamingChatModel({
      sleep: MOCK_SQL_CHUNK_DELAY_MS,
      chunks: [new AIMessageChunk({
        content: '',
        tool_calls: [{
          id: randomUUID(),
          name: selected.name,
          args: selected.name === 'construct_sql'
            ? { request: this.request }
            : { query: MOCK_SQL },
          type: 'tool_call',
        }],
      })],
    }).bindTools(tools);
  }
}
