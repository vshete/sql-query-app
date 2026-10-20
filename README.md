# Query Studio

An AI-assisted PostgreSQL workspace built with Next.js, React, TypeScript, LangChain, and in-process MCP tools. Ask a question in plain language, inspect the generated SQL, and explore real results through sortable, resizable tables and CSV downloads. Follow-up questions use bounded conversation context.

The public demo intentionally has no login, making it easy for anyone to try the idea and explore its usability with demonstration data.

The active workspace provides a schema explorer and chat. Manual SQL components are retained but are not mounted; their HTTP endpoints remain available.

[![A question in plain language becomes a checked database query, then an answer and result table.](mermaid/rendered/00-at-a-glance.svg)](mermaid/rendered/00-at-a-glance.svg)

Follow the numbers on the arrows from question to result. Open the image at full size, or explore the [whole-app flow](mermaid/rendered/00-overall.svg) and [diagram library](mermaid/README.md).

## Quick start

Prerequisites: a Node.js version supported by the installed Next.js release, npm, PostgreSQL, and a Gemini or OpenAI API key. Docker Compose is optional for local datasets. Use the lockfile for reproducible dependency installation.

```bash
npm ci
cp env.example .env
```

Edit `.env` with your database URL and provider credentials, then run:

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000). Startup prepares Next.js, authenticates the shared database pool, and loads schema metadata before listening. Connection authentication retries three times after the first attempt, one second apart. A database or schema failure prevents startup. Restart after changing environment variables.

## Configuration

All settings below are server-side. Never prefix database credentials or provider keys with `NEXT_PUBLIC_`.

| Variable                           | Purpose                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL`                     | Required PostgreSQL connection used by queries, schema discovery, and exports |
| `AI_PROVIDER`                      | `gemini` (default) or `openai`                                                |
| `AI_API_KEY`                       | Primary Gemini key; fallback key for OpenAI                                   |
| `GEMINI_API_KEY`, `GOOGLE_API_KEY` | Gemini fallback keys, in that order after `AI_API_KEY`                        |
| `OPENAI_API_KEY`                   | Primary OpenAI key                                                            |
| `AI_MODEL`                         | Explicit model override                                                       |
| `LANGCHAIN_MODEL`                  | Fallback model override if `AI_MODEL` is absent                               |
| `PORT`                             | Custom-server port; defaults to `3000`                                        |
| `DATABASE_SEED_URL`                | Optional separate privileged connection for ecommerce seeding                 |
| `DATABASE_TEST_URL`                | Optional disposable database for live integration tests                       |

Code defaults are `gemini-3.5-flash` and `gpt-4o-mini`; these are application configuration values, not a guarantee of provider availability. `env.example` explicitly sets the Gemini model, so change `AI_MODEL` as well when switching providers. Preserve your provider's required PostgreSQL SSL parameters; the example uses `sslmode=verify-full`.

## Local PostgreSQL datasets

```bash
docker compose up -d --wait
```

Use one of these URLs for `DATABASE_URL` and restart the app:

| Dataset   | App on host                                                          | App on the Compose network                                                  |
| --------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Ecommerce | `postgresql://query_app:query_app_local@localhost:5432/query_app`    | `postgresql://query_app:query_app_local@postgres:5432/query_app`            |
| Banking   | `postgresql://banking_app:banking_local@localhost:5434/banking_demo` | `postgresql://banking_app:banking_local@banking-postgres:5432/banking_demo` |

Ports above match [compose.yaml](compose.yaml). These credentials are for local development.

Seed ecommerce separately:

```bash
npm run db:seed
```

The seed loads `.env`, runs in a transaction, and inserts 4,288 deterministic records across categories, employees, customers, products, orders, and order details. `ON CONFLICT DO NOTHING` preserves existing rows on reruns; incompatible tables cause rollback. Use a dedicated demo database. The SQL is also available in [scripts/seed.sql](scripts/seed.sql).

The banking container runs [scripts/populate-test-db.sql](scripts/populate-test-db.sql) on first initialization of an empty volume. It contains synthetic branches, customers, loans, installments, credit cards, merchants, sales, statements, and a defaulters view in `banking_demo`, with INR amounts and an October 1, 2026 snapshot. To start only banking or explicitly replace its data:

```bash
npm run db:banking:up
npm run db:seed:banking
```

Reseeding drops and recreates the entire `banking_demo` schema in one transaction. `db:seed:docker` aliases the same command. Volumes retain data across restarts.

Example questions: “Total loans by branch and loan type”, “Card sales by merchant category excluding refunds”, or “List defaulters by overdue amount”.

## Development without provider calls

```bash
npm run dev:mockModel
# Equivalent: npm run dev -- --mockModel
```

Mock mode exercises the real agent, MCP transport, SQL validation, and PostgreSQL execution. It still requires `DATABASE_URL` and the ecommerce `customers` table, but no AI key. It streams fixed SQL and a fixed summary:

```sql
SELECT customer_id, company_name, country
FROM customers
ORDER BY customer_id
LIMIT 25;
```

Production ignores the mock flag. Use a real model for arbitrary schemas.

## How a question becomes a result

1. `QueryWorkspace` loads schema metadata independently of chat. `NaturalLanguageInput` submits the draft through `useAIQueryGeneration`.
2. `streamQuery` opens `/api/agent/stream`, sends the request and bounded history, batches preview updates per browser paint, and owns socket cleanup.
3. `handleQuerySocket` validates input and applies a 180-second deadline. Disconnecting aborts agent/model work.
4. `runQueryAgent` registers a request-local context. LangChain invokes tools over a shared in-memory MCP connection using an internal request ID.
5. `construct_sql` reads cached schema, streams provisional SQL, and validates syntax, statement policy, and table references. `execute_query` accepts exactly that generated SQL.
6. Database execution uses a read-only transaction, a 10-second statement timeout, a 3-second lock timeout, and a cursor capped at 1,000 returned rows. The WebSocket path then asks the model to explain all loaded rows.
7. The final result is validated in the browser. Tables paginate and sort loaded rows; Download CSV exports that same snapshot without running SQL again.

SQL and answer tokens are separate. Preview text is provisional until the final result arrives. Numeric values returned by PostgreSQL as strings remain strings to avoid precision loss. Dates become ISO strings; compound values become JSON text. `rowCount` means loaded rows, not total database matches. CSV quotes fields and prefixes formula-like string values with an apostrophe.

### Result rows sent to the model

[`buildQueryResultContext`](src/lib/shared/queryConversation.ts) includes every loaded row in `rows`, alongside the explanation, SQL, columns, loaded-row count, and truncation flag. There is no additional row sampling or per-result character reduction. PostgreSQL execution still returns at most 1,000 rows.

Two paths use this result context:

- **Current result explanation:** [`summarizeResults.ts`](src/lib/server/agent/summarizeResults.ts) sends the full result context as `executedResult` to `model.stream`, independently of the history budget. [`querySocket.ts`](src/lib/server/transport/querySocket.ts) enables this with `summarizeResults: true`; `/api/post/agent` does not request this extra model call.
- **Follow-up questions:** [`useAIQueryGeneration.ts`](src/hooks/useAIQueryGeneration.ts) calls `appendQueryHistory` after a successful turn. Every retained turn includes all its loaded rows. History remains capped at 40 messages and 120,000 characters by dropping oldest complete question/answer pairs. A single turn exceeding that total budget is omitted entirely; its rows are never sampled down to fit.

The browser table and snapshot CSV use the same loaded rows. SQL filters, explicit limits, and execution truncation still constrain what these rows cover. In real-provider mode all loaded row values can leave the app; the app does not redact them. See [demo data handling](docs/security.md#data-sent-to-the-model-provider).

### Request sequence

This sequence shows a typical question that needs database data. The app checks the generated SQL before reading rows, then optionally asks the AI provider to explain all loaded rows, up to 1,000.

[![Numbered messages show a question traveling from the browser to the app, AI provider, and database, followed by an optional explanation and the final answer and table.](mermaid/rendered/08-end-to-end-sequence.svg)](mermaid/rendered/08-end-to-end-sequence.svg)

Open the image at full size to follow each exchange. The [agent guide](docs/query-agent.md) also covers direct answers, query failures, and summary warnings.

## API reference

| Endpoint                      | Input                   | Response / behavior                                                                 |
| ----------------------------- | ----------------------- | ----------------------------------------------------------------------------------- |
| `GET /api/database/schema`    | None                    | `{ tables }` from the shared server schema cache                                    |
| `POST /api/database/schema`   | None                    | Refreshes server schema and returns `{ tables }`                                    |
| WebSocket `/api/agent/stream` | `{ request, history? }` | `sql_start`, `token`, `agent_token`, then `result` or `error`                       |
| `POST /api/post/agent`        | `{ request }`           | Non-streaming agent result; does not forward history or request an optional summary |
| `POST /api/post/query`        | `{ query }`             | Structured real PostgreSQL result                                                   |
| `POST /api/post/download`     | `{ query }`             | Re-executes SQL and returns a CSV attachment, capped at 1,000 rows                  |

Unlike the UI's snapshot download, the CSV HTTP endpoint executes a new query and may see changed data. HTTP routes use Pages Router handlers under `src/pages/api`; the streaming platform adapter is an App Router handler under `src/app/api`.

## Cache ownership

| Cache                        | Scope                                      | Invalidation                                                       |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| Database pools               | Process/global map keyed by connection URL | Process restart; no application eviction policy                    |
| Server schema                | Process/global weak map keyed by pool      | Explicit refresh or restart; failed refresh preserves last success |
| Browser schema               | Module cache plus shared pending request   | Successful refresh or page reload                                  |
| MCP connection               | Module-level connection promise            | Explicit teardown or process restart; setup failure allows retry   |
| Generation/execution/summary | Request context promises                   | Disposed after the agent turn; duplicate tool calls reuse work     |
| Model history                | Hook ref, bounded by protocol limits       | New chat or workspace unmount                                      |

Visible conversation turns retain full result snapshots separately from bounded model history. There is no query-result cache. Current schema refresh is process-local; it does not invalidate other server instances or browser tabs. Prompt files are read per run, while MCP tool descriptions are captured when its connection is created.

## Repository map

See the [architecture documentation index](docs/README.md) for the component, hook, rendering, agent/tool, transport, database, and testing guides.

[![The whole-app flow connects the browser workspace, app server, AI provider, and PostgreSQL, including progress updates, schema browsing, cancellation, and local result exploration.](mermaid/rendered/00-overall.svg)](mermaid/rendered/00-overall.svg)

The numbered arrows show the main request flow; side branches show supporting exchanges and optional actions. See [application architecture](docs/architecture.md) for responsibilities and state ownership.

```text
server.ts                         Custom HTTP server and startup ordering
src/app/
  page.tsx, layout.tsx, error.tsx  Route, shared shell, render-error recovery
  api/agent/stream/route.ts       Platform WebSocket adapter
src/components/query/            Workspace, prompt, schema tree, results
  manual/                        Retained manual SQL UI (not mounted)
src/components/editor/           CodeMirror setup and styling
src/hooks/                       Async UI lifecycles and table state
src/lib/client/                  Browser HTTP, socket, schema cache, downloads
src/lib/server/agent/            Agent, MCP, provider factory, mocks, prompts
src/lib/server/database/         Pool, initialization, schema SQL, execution
src/lib/server/transport/        HTTP/WebSocket server and origin checks
src/lib/shared/                  Scalar formatting, CSV, conversation helpers
src/types/                       Shared result, schema, and transport contracts
src/pages/api/                   HTTP schema, agent, query, and CSV handlers
scripts/                         Dataset provisioning
tests/                          Node test runner suites
```

`tests/fixtures/` holds the legacy manual CSV and static schema text; production code uses live PostgreSQL metadata. The provider factory and deterministic model remain server-owned because mock mode is a supported development runtime.

`npm test` checks the local import graph so components, hooks, browser helpers, shared helpers, and wire types cannot transitively import server modules or Node dependencies. We avoid the bare `server-only` package marker: its default Node export throws during direct `tsx server.ts` and Node test execution. The graph check enforces the boundary without changing Node resolution conditions. Keep runtime prompts and catalog SQL under `src/lib/server/`; `next.config.ts` explicitly includes them in production file tracing. Run the custom server from the repository root.

The earlier [React review](REACT_CODE_REVIEW.md) is historical and contains paths/contracts that have since changed.

## Checks and debugging

```bash
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

Focused scripts: `test:sql`, `test:db`, `test:mcp`, `test:stream`, `test:manual`, and `test:mockModel`. Live database tests require `DATABASE_TEST_URL`; otherwise they skip. Use a disposable test database.

VS Code includes Run Task entries and Run and Debug configurations for all tests, the active test file, and the server with or without mocks. Open a `tests/*.test.ts` file for current-file actions. Stop an existing server on the same port before debugging. Update the explicit test lists in `.vscode/tasks.json` and `.vscode/launch.json` when adding test files.

## Running a production build

```bash
npm run build
npm start
```

The default path uses a persistent custom Node server. Its host or reverse proxy must forward WebSocket upgrades. A separate platform route uses an experimental WebSocket adapter; validate that deployment path independently rather than assuming parity with the custom server.

Login is intentionally omitted for the public demonstration. The query path protects the demo database by validating a single SELECT-based statement and executing it inside a PostgreSQL read-only transaction. Writes, deletes, and schema changes are rejected; dataset seeding is a separate administrative operation. See [public demo and read-only safeguards](docs/security.md) for the implementation.

## Troubleshooting

- **Startup fails:** check `DATABASE_URL`, PostgreSQL reachability, SSL settings, and schema permissions.
- **Banking connection refused:** the supplied Compose host port is `5434`, not `5433`.
- **New tables missing:** use Schema explorer → Refresh. Restart after changing the database URL.
- **Mock query fails:** seed ecommerce and confirm its public `customers` table exists.
- **Stream closes early:** check custom-server logs, upgrade forwarding, request origin, and deadline limits.
- **Agent provider fails:** verify both the key and `AI_MODEL`; changing `AI_PROVIDER` does not remove an explicit model override.
