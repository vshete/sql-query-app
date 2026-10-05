# SQL Query App

The app has two inputs: natural language with quick suggestions, and manual SQL entry.
Natural-language requests stream SQL and agent responses into the browser. Manual queries
show a resizable, sortable results table with pagination and a full CSV download.

Both execution paths use demo data. The agent validates SQL and returns representative mock
results. The manual-query endpoint returns a fixed orders dataset regardless of the SQL entered.

## Development

```bash
npm install
cp env.example .env
npm run dev
```

Set your provider and API key in `.env`, then open http://localhost:3000.
For production, run `npm run build` followed by `npm start`.

## Code map

- `src/app/comonents/AppEntry.tsx`: natural-language input, manual SQL input, and results.
- `src/app/hooks/useAIQueryGeneration.ts`: WebSocket client for agent streaming.
- `src/app/services/queryAgent.ts`: LangChain agent, MCP schema/tools, and mock execution.
- `src/app/services/sqlValidation.ts`: PostgreSQL parsing and read-only query policy.
- `src/app/types/query.types.ts`: shared agent response and mock result types.
- `server.ts`: Next.js server and `/api/agent/stream` WebSocket endpoint.
- `pages/api/post/agent.ts`: non-streaming agent POST endpoint.
- `pages/api/post/query.ts`: paginated manual-query demo results.
- `pages/api/post/download.ts`: complete manual-query CSV export.
- `src/app/services/manualQuery.ts`: shared manual-query demo dataset and pagination.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run test:sql
npm run test:stream
npm run test:manual
npm run build
```

## LangChain and MCP Query Agent

The natural-language SQL builder uses a server-side LangChain agent. It reads the demo schema from the MCP resource `demo://database/schema`, constructs a read-only query with the `construct_sql` MCP tool, then calls the `execute_mock_query` MCP tool. The database tool returns representative mock data only; it does not connect to a live database.

To enable the agent, create a local `.env` file from `env.example`. Gemini is the default provider: set `AI_API_KEY` to your Gemini API key; `AI_MODEL` defaults to `gemini-3.5-flash`. You can alternatively set `AI_PROVIDER=openai` with `OPENAI_API_KEY` and optionally `LANGCHAIN_MODEL` (or `AI_MODEL`). The `.env` file is gitignored, and keys are only read by the server-side API route, never sent to browser code.

Mock scenarios include table-specific sample rows, aggregate/count responses, empty results (`WHERE 1 = 0`), and a simulated database error when a query contains `MOCK_DB_ERROR`.

### Query agent streaming

Run `npm run dev` (or `npm run build` followed by `npm start`). These commands use
the custom Node server in `server.ts`, which serves Next.js and upgrades
`/api/agent/stream` to a WebSocket on the same port. A deployment must support
a persistent Node process and forward WebSocket upgrades; serverless Next.js
API hosting alone cannot serve this endpoint.

The browser sends `{ "request": "..." }`. The server sends `sql_start` before each SQL generation, `token` events with
SQL text chunks, `agent_token` events for the agent response, then a `result` event containing the validated query and mock
results, or an `error` event. The preview is provisional until the result arrives.
Disconnecting aborts generation. API keys stay on the server, using the existing
AI_PROVIDER, AI_API_KEY / OPENAI_API_KEY, and AI_MODEL settings.

SQL syntax, statement boundaries, and table references are checked with
`dt-sql-parser`'s PostgreSQL parser. Additional policy restricts queries to one
SELECT over demo tables, rejecting write CTEs, SELECT INTO, and row locks.
Syntax validation does not verify column existence or guarantee that arbitrary
SQL functions are free of side effects; execution remains a mock database.

Run parser regression checks with `npm run test:sql`.

The SQL editor updates with each received chunk and stays disabled during generation.
Providers choose chunk boundaries: a Gemini chunk can contain many tokens, including
most of a short query. The app forwards chunks immediately without synthesizing a
typing animation. `npm run test:stream` verifies callbacks fire while streamed
provider responses are still open, through the LangChain agent and MCP tools.
