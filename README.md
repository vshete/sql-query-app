# SQL Query App

The app has two inputs: natural language with quick suggestions, and manual SQL entry.
Natural-language requests stream SQL and agent responses into the browser. Manual queries
show a resizable, sortable results table with pagination and a full CSV download.

The natural-language agent validates SQL and executes it against PostgreSQL.
The separate manual-query and CSV endpoints still return their fixed demo orders dataset.

## Development

```bash
npm install
cp env.example .env
npm run dev
```

Set your provider, API key, and `DATABASE_URL` in `.env`, then open http://localhost:3000.
For production, run `npm run build` followed by `npm start`.

## Code map

- `src/app/comonents/AppEntry.tsx`: natural-language input, manual SQL input, and results.
- `src/app/hooks/useAIQueryGeneration.ts`: WebSocket client for agent streaming.
- `src/app/services/queryAgent.ts`: LangChain agent, MCP schema/tools, and PostgreSQL execution.
- `src/app/services/sqlValidation.ts`: PostgreSQL parsing and read-only query policy.
- `src/app/types/query.types.ts`: shared agent response and database result types.
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
npm run test:db
npm run test:stream
npm run test:manual
npm run build
```

## LangChain and MCP Query Agent

The natural-language SQL builder uses a server-side LangChain agent. It reads the sales schema
from the MCP resource `postgres://database/schema`, constructs a read-only query with
`construct_sql`, then calls `execute_query`. Both the POST API and WebSocket path use this tool.
The response contains `queryResult` with actual columns, rows, returned row count, and a
`truncated` flag. Numeric/count values retain PostgreSQL's string representation to avoid
precision loss; dates are serialized as ISO strings.

### PostgreSQL setup and seed

Start the included local PostgreSQL database (requires Docker Compose):

```bash
docker compose up -d --wait
cp env.example .env  # for a new setup; preserve an existing .env
npm run db:seed
npm run dev
```

Use `DATABASE_URL=postgresql://query_app:query_app_local@localhost:5432/query_app`
for this local container. You can instead use an existing PostgreSQL database. SSL settings
can be supplied in the connection URL, as required by your database provider.

`npm run db:seed` loads `.env`, creates the six public tables and indexes, and inserts
**4,288 deterministic records**: 8 categories, 30 employees, 150 customers, 100 products,
1,000 orders, and 3,000 order details. Dates span January 2024 through September 2026.
Foreign keys connect the records for joins and revenue aggregates. The seed runs in one
transaction, prints table counts, and uses `ON CONFLICT DO NOTHING` so reruns preserve
existing rows. Use a dedicated demo database; incompatible existing tables cause a rollback.
The SQL is also available in `scripts/seed.sql` for PostgreSQL clients.

For deployments, use a database role with only SELECT permission on these six public tables
for `DATABASE_URL`. Set `DATABASE_SEED_URL` to a separate schema/create/insert connection
when necessary. The container's credentials are for local development.
Queries run in a read-only transaction with a 10-second statement timeout and 3-second lock
timeout. A server-side cursor returns at most 1,000 rows and reports truncation.

Gemini is the default provider: set `AI_API_KEY`; `AI_MODEL` defaults to `gemini-3.5-flash`.
Alternatively set `AI_PROVIDER=openai` and `OPENAI_API_KEY`. Keys and database connection
strings stay on the server.

Run `npm run test:db` for connection lifecycle and query-policy checks. To also run the
live seed/join/aggregate checks against a disposable database:

```bash
DATABASE_TEST_URL=postgresql://query_app:query_app_local@localhost:5432/query_app npm run test:db
```

### Query agent streaming

Run `npm run dev` (or `npm run build` followed by `npm start`). These commands use
the custom Node server in `server.ts`, which serves Next.js and upgrades
`/api/agent/stream` to a WebSocket on the same port. A deployment must support
a persistent Node process and forward WebSocket upgrades; serverless Next.js
API hosting alone cannot serve this endpoint.

The browser sends `{ "request": "..." }`. The server sends `sql_start` before each SQL generation, `token` events with
SQL text chunks, `agent_token` events for the agent response, then a `result` event containing the validated query and PostgreSQL
results, or an `error` event. The preview is provisional until the result arrives.
Disconnecting aborts generation. API keys stay on the server, using the existing
AI_PROVIDER, AI_API_KEY / OPENAI_API_KEY, and AI_MODEL settings.

SQL syntax, statement boundaries, and table references are checked with
`dt-sql-parser`'s PostgreSQL parser. Additional policy restricts queries to one
SELECT over demo tables, rejecting write CTEs, SELECT INTO, and row locks.
Syntax validation does not verify column existence or guarantee that arbitrary
SQL functions are free of side effects; use a restricted database role in addition to the
read-only transaction.

Run parser regression checks with `npm run test:sql`.

The SQL editor updates with each received chunk and stays disabled during generation.
Providers choose chunk boundaries: a Gemini chunk can contain many tokens, including
most of a short query. The app forwards chunks immediately without synthesizing a
typing animation. `npm run test:stream` verifies callbacks fire while streamed
provider responses are still open, through the LangChain agent and MCP tools.
