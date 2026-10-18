# SQL Query App

The app offers natural-language queries with a schema explorer. Requests stream SQL and
agent responses into the browser, with a resizable, sortable results table, pagination, and CSV download.
Manual SQL components and API routes are retained for future use but are not shown in the workspace.

The natural-language agent validates SQL and executes it against PostgreSQL.
Both natural-language and manual SQL queries use the default PostgreSQL connection configured by server-side `DATABASE_URL`.

## Development

```bash
npm install
cp env.example .env
npm run dev
```

Set your provider, API key, and PostgreSQL connection URL as `DATABASE_URL` in `.env`, then open http://localhost:3000. The server authenticates its shared database pool and loads the schema before accepting requests. The page renders immediately while reading cached schema metadata in the background. Restart the server after changing `.env`. The URL stays on the server; users cannot select or enter a different URL in the UI.
For production, run `npm run build` followed by `npm start`.

To mock model calls during development:

```bash
npm run dev:mockModel
# Alternatively: npm run dev -- --mockModel
# npm versions that forward custom config flags also support: npm run dev --mockModel
```

Mock mode needs `DATABASE_URL`, but no AI API key. Every natural-language request
returns `SELECT customer_id, company_name, country FROM customers ORDER BY customer_id LIMIT 25;`.
The fake model emits tool calls through the same LangChain agent and middleware as
production, and streams fixed SQL inside `construct_sql` without provider calls. SQL validation and PostgreSQL
execution remain active. Mock factories and models live in `src/app/services/mocks`.
Production ignores the mock flag. Run `npm run test:mockModel` to check this path.

## Code map

- `src/app/comonents/AppEntry.tsx`: natural-language input, schema explorer, and results.
- `src/app/hooks/useAIQueryGeneration.ts`: WebSocket client for agent streaming.
- `src/app/services/queryAgent.ts`: LangChain agent, MCP tools, and PostgreSQL execution.
- `src/app/services/sqlValidation.ts`: PostgreSQL parsing and read-only query policy.
- `src/app/types/query.types.ts`: shared agent response and database result types.
- `server.ts`: Next.js server and `/api/agent/stream` WebSocket endpoint.
- `pages/api/post/agent.ts`: non-streaming agent POST endpoint.
- `pages/api/post/query.ts`: real manual-query results from the configured connection.
- `pages/api/post/download.ts`: CSV export of the configured connection’s query results (up to 1,000 rows).
- `src/app/services/manualQuery.ts`: legacy demo fixture, no longer used by the API or UI.

## Checks

### VS Code tests and debugging

Use **Terminal → Run Task** to select **Test: All tests** or **Test: Current file**.
For the current-file task or debug configuration, open a `tests/*.test.ts` file first.

In **Run and Debug**, select **Debug: Current test file**, **Debug: All tests**,
**Debug: Node server**, or **Debug: Node server (mock model)**, then press **F5**.
Set breakpoints in the TypeScript tests, `server.ts`, API routes, or server services.
Use **Ctrl+F5** with the same configuration to run without debugging.
The server configurations use the usual `.env` setup and development port (3000 by default);
stop any existing server on that port before launching. **Attach: Node process** can
connect to an already running Node process.

All-test configurations list the test files explicitly; update both `.vscode/launch.json`
and `.vscode/tasks.json` when adding a new test file. Database integration tests still
require `DATABASE_TEST_URL` in the environment; otherwise they are skipped.

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

The natural-language SQL builder uses a server-side LangChain agent. It discovers the connected PostgreSQL database schema from the system catalogs,
caches it in server memory, and constructs a read-only query with
`construct_sql`, then calls `execute_query`. Both the POST API and WebSocket path use this tool.
The response contains `queryResult` with actual columns, rows, returned row count, and a
`truncated` flag. Numeric/count values retain PostgreSQL's string representation to avoid
precision loss; dates are serialized as ISO strings.

### PostgreSQL setup and seed

Start the included local PostgreSQL database (requires Docker Compose):

```bash
docker compose up -d --wait
cp env.example .env  # for a new setup; preserve an existing .env
npm run dev
```

For local development instead of Neon, set `DATABASE_URL` in `.env` to one of these Docker PostgreSQL URLs and restart the server:

| Dataset   | Connection URL                                                       |
| --------- | -------------------------------------------------------------------- |
| Ecommerce | `postgresql://query_app:query_app_local@localhost:5432/query_app`    |
| Banking   | `postgresql://banking_app:banking_local@localhost:5433/banking_demo` |

For an app running inside the same Docker Compose network:

| Dataset   | Connection URL                                                              |
| --------- | --------------------------------------------------------------------------- |
| Ecommerce | `postgresql://query_app:query_app_local@postgres:5432/query_app`            |
| Banking   | `postgresql://banking_app:banking_local@banking-postgres:5432/banking_demo` |

Use the ecommerce URL for `DATABASE_URL` in `.env` when that is your default database.
You can instead use an existing PostgreSQL database. SSL settings
can be supplied in the connection URL, as required by your database provider.

A separate banking database supports testing a different dataset alongside the existing
ecommerce database:

```bash
npm run db:banking:up
```

Set `DATABASE_URL` in `.env` to the following URL, restart the server, and reload the page:

```text
postgresql://banking_app:banking_local@localhost:5433/banking_demo
```

Switch back to ecommerce by setting `DATABASE_URL` to
`postgresql://query_app:query_app_local@localhost:5432/query_app`.
For an app running inside the same Compose network, use host `banking-postgres` and port
`5432` instead of `localhost:5433`.

The banking container initializes `scripts/populate-test-db.sql` only on its first startup
with an empty volume. Its independent volume preserves data across restarts. The script
creates the `banking_demo` schema with 5 branches, 200 fictional customers, 240 loans,
1,440 loan installments, 220 credit cards, 25 merchants, 4,400 card sales, 440 statements,
and a derived `defaulters` view. Amounts are INR; the fixed snapshot is October 1, 2026.
Sales include settled, refunded, and declined transactions; statements include fully paid,
partially paid, and unpaid balances. Defaulters have missed loan installments or card
minimum payments. Only synthetic names, example emails, and card last-four digits are used.

To replace banking data in the running container:

```bash
npm run db:seed:banking
# db:seed:docker is an alias for the same command.
```

Reseeding drops and recreates the entire `banking_demo` schema in one transaction.
For a custom Compose project, prefix commands with `COMPOSE_PROJECT_NAME=your-project`.

Try prompts such as "Total loans issued by branch and loan type", "Credit card sales
by merchant category, excluding declined and refunded transactions", or "List defaulters
with overdue amounts and days past due". Example SQL:

```sql
SELECT c.full_name, d.credit_product, d.overdue_amount, d.days_past_due
FROM banking_demo.defaulters d
JOIN banking_demo.customers c USING (customer_id)
ORDER BY d.overdue_amount DESC;
```

The alternative `npm run db:seed` loads `.env`, creates the six public tables and indexes, and inserts
**4,288 deterministic records**: 8 categories, 30 employees, 150 customers, 100 products,
1,000 orders, and 3,000 order details. Dates span January 2024 through September 2026.
Foreign keys connect the records for joins and revenue aggregates. The seed runs in one
transaction, prints table counts, and uses `ON CONFLICT DO NOTHING` so reruns preserve
existing rows. Use a dedicated demo database; incompatible existing tables cause a rollback.
The SQL is also available in `scripts/seed.sql` for PostgreSQL clients.
Use this seed for the ecommerce database on port 5432; the banking database has a
separate schema and seed command.

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
SELECT over tables in the selected database schema, rejecting write CTEs, SELECT INTO, and row locks.
Syntax validation does not verify column existence or guarantee that arbitrary
SQL functions are free of side effects; use a restricted database role in addition to the
read-only transaction.

Run parser regression checks with `npm run test:sql`.

The SQL editor updates with each received chunk and stays disabled during generation.
Providers choose chunk boundaries: a Gemini chunk can contain many tokens, including
most of a short query. The app forwards chunks immediately without synthesizing a
typing animation. `npm run test:stream` verifies callbacks fire while streamed
provider responses are still open, through the LangChain agent and MCP tools.

### Server database and schema refresh

Set `DATABASE_URL` in `.env` to your connection URL. For hosted PostgreSQL, use `sslmode=verify-full` to preserve certificate and hostname verification and avoid the `pg` SSL-mode deprecation warning. Preserve any other SSL parameters supplied by your provider.
Restart the server after configuration changes. Startup authenticates the shared
Sequelize pool and loads the schema before listening; a database or schema failure
prevents startup. Browser sessions do not connect, disconnect, or own database pools.

The query workspace is enabled immediately. The schema explorer reads cached metadata
from `GET /api/database/schema` in the background. Refresh sends `POST` to the same
endpoint to update the shared schema used by both the explorer and the agent. Metadata
stays cached until explicit refresh or server restart, so page loads do not query the
catalogs again. A failed refresh keeps the last successful schema available.

Queries and CSV exports use the same server-configured pool without connection cookies.
The pool allows up to 10 connections and releases idle connections after 30 seconds;
Sequelize handles acquiring connections as needed. Results include up to 1,000 rows.

Mock mode still requires a real PostgreSQL database. Its deterministic queries target
the demo SQL; use the real model for arbitrary schemas.


`POST /api/post/query` now returns structured real database results (`columns`, `rows`,
`rowCount`, `truncated`, `message`). `POST /api/post/download` requires a `query` and exports
its real results rather than the former demo dataset.
