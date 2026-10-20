# Application architecture

Query Studio is a Next.js App Router page backed by React client components, a server-owned PostgreSQL connection pool, and a LangChain query agent. The agent exposes typed in-process MCP tools to generate and execute a query. The active UI streams SQL and assistant text over a WebSocket and renders the final result snapshot.

[Documentation home](./README.md) · [Public demo and read-only safeguards](./security.md) · [Testing and operations](./testing-operations.md)

**On this page:** [Runtime layers](#runtime-layers) · [Request flow](#one-streamed-question-end-to-end) · [State](#data-and-state-ownership) · [Design choices](#design-choices-and-tradeoffs) · [Deployment](#deployment-and-trust-boundaries) · [Source map](#source-map)

## Scope

The current product is a single-database query workspace: users explore the configured schema, ask questions, and inspect results. Every caller uses the same server-configured database role. The app does not implement user accounts, tenant isolation, persisted conversations, database migrations, or background query jobs.

## Runtime layers

[![The browser owns interaction, the server owns request coordination and SQL checks, PostgreSQL stores the queried data, and the AI provider generates queries and explanations.](../mermaid/rendered/01-architecture.svg)](../mermaid/rendered/01-architecture.svg)

Open the image at full size, or see the [whole-app request flow](../mermaid/rendered/00-overall.svg).

The browser owns interaction and display. Server adapters validate requests and invoke the agent. In-process MCP tools generate SQL, enforce policy, and execute it through a PostgreSQL pool. Model calls leave the server for the configured Gemini or OpenAI provider; MCP itself does not open a network listener.

The import boundary is intentional:

- `src/app`, `src/components`, and `src/hooks` implement the page and UI.
- `src/lib/client` contains browser-only transport, HTTP, schema-cache, validation, and download helpers.
- `src/lib/shared` and `src/types` are safe to share between browser and server.
- `src/lib/server` owns database, model, prompt, tool, and transport code. These modules must not enter the browser dependency graph.

The [module-boundary test](../tests/moduleBoundaries.test.ts) checks this separation transitively. The project does not mark server modules with the `server-only` package because direct Node/tsx execution and tests use Node's default conditions.

## Rendering and route layout

- `src/app/layout.tsx` is the App Router root layout. It loads global styles and fonts, sets metadata, and provides the skip link.
- `src/app/page.tsx` renders `AppEntry`; `AppEntry` provides the app shell and imports the client workspace.
- `QueryWorkspace` and its descendants are interactive client components. They are not server-side query execution surfaces.
- The CodeMirror editor within the SQL preview and the streamed Markdown response are dynamically imported. `QueryPreview` itself is statically imported by the conversation view.
- `src/app/error.tsx` is the App Router error boundary; `src/app/globals.css` and `queryAgent.module.css` hold global and workspace styling.
- HTTP APIs use the Pages Router under `src/pages/api`. The platform WebSocket endpoint is an App Router route at `src/app/api/agent/stream/route.ts`. Both routers coexist in this application.

See [Frontend and rendering](./frontend.md) for component ownership and [Transport and APIs](./transport-api.md) for route behavior.

## One streamed question, end to end

1. The user submits a natural-language prompt in `NaturalLanguageInput`. `useAIQueryGeneration` trims and bounds the prompt, owns the current turn, history, cancellation controller, and visible turn snapshots.
2. `streamQuery` opens `/api/agent/stream`, sends `{ request, history? }`, validates incoming events, and batches SQL/answer preview updates to browser animation frames.
3. The custom Node server or the platform route validates the WebSocket request. `handleQuerySocket` applies the request limit and deadline, parses bounded conversation history, resolves the server model configuration and database, and starts `runQueryAgent`.
4. The agent reads prompt files and uses a shared in-memory MCP client/server pair. A fresh opaque request ID maps to a request-local context; credentials, model instance, and callbacks remain on the server.
5. The model calls `construct_sql`. The tool loads cached database metadata, streams provisional SQL tokens separately, and validates the final SQL for syntax, one-statement/read-only policy, and table membership.
6. The model calls `execute_query` with exactly the generated SQL. The tool revalidates it, runs it in a read-only PostgreSQL transaction, and saves the typed result in request context.
7. The agent stops its model loop after execution. If requested, the server separately calls `summarize_results` to send all loaded rows (up to 1,000) to the model and stream an explanation. A summary failure adds a warning without discarding the successful table.
8. The server sends the final result event. The browser validates the result before the UI presents it. Table sorting and pagination operate on loaded rows only; the UI's CSV action exports that same snapshot without querying again.

The visible streamed SQL is provisional until the validated final result arrives. SQL text and assistant-answer text are distinct streams. See [Query agent and tools](./query-agent.md) and [Database and result data](./database.md).

The [illustrated MCP flow guide](./mcp-flow.md) follows the in-process tool exchanges in detail and shows how later turns can answer from history, ask for clarification, or execute a fresh query. It also separates the shared MCP connection's lifetime from each turn's context and browser-owned conversation history.

## Data and state ownership

| State                                             | Owner                                            | Lifetime / invalidation                                                                 |
| ------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| PostgreSQL pool                                   | Server process, keyed by connection URL          | Process lifetime; restart to replace configuration                                      |
| Schema metadata                                   | Server-process WeakMap keyed by pool             | Explicit refresh or process restart; failed refresh does not replace last good snapshot |
| Schema metadata in browser                        | Client module cache and shared in-flight request | Successful load/refresh or page reload                                                  |
| MCP connection                                    | Module-level promise shared by query turns       | Reused across turns; explicit close helper or process exit                              |
| Agent model, generated SQL, tool promises, result | Per-request context in the server registry       | Removed in `finally` when the agent turn settles                                        |
| Visible conversation turns                        | React state in the workspace hook                | Current workspace mount; cleared by New chat                                            |
| Model conversation history                        | Ref in `useAIQueryGeneration`                    | Bounded independently from visible turns; reset by New chat                             |
| Result-table sort, page, and sizing               | `useQueryResultTable`                            | Current result view; reset when a result changes                                        |

There is no query-result cache. Server schema refresh does not invalidate other server instances or already cached browser tabs. Prompt files are read for each agent run, while MCP tool descriptions use the prompt values captured when the shared connection was created.

Visible conversation turns have no count or memory cap and are not persisted by the app. Only the history sent to the model is bounded. New chat or workspace unmount releases the visible conversation state.

## Design choices and tradeoffs

These choices are visible in the current implementation. Record a separate architecture decision record (ADR) when a future change needs a durable explanation of alternatives and consequences.

| Choice                                         | Benefit                                                            | Tradeoff                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Persistent Node server for the default runtime | Owns HTTP, WebSocket upgrades, and startup checks together         | Requires a host and proxy that support long-lived connections       |
| In-process MCP with request IDs                | Typed tool contracts and shared setup with isolated per-turn state | Tools and agent share a process and failure domain                  |
| Schema cache per pool/process                  | Avoids a catalog read on every turn                                | Refresh does not propagate across instances or tabs                 |
| Bounded cursor results and browser table state | Limits returned rows; sort, page, and export need no extra query   | Loaded rows are a partial view; there is no full-dataset pagination |
| Separate model history and visible turns       | Bounds model context while retaining prior results on screen       | Long sessions can still grow browser memory                         |
| Separate optional result summary               | Summary failures can preserve a successful table                   | Adds a model call and sends all loaded rows to the provider         |

## Deployment and trust boundaries

The normal `npm run dev` and `npm start` paths use `server.ts`: it prepares Next, initializes the database and schema, then serves HTTP and WebSocket traffic from a custom Node server. The App Router WebSocket route is an alternate platform adapter and should be validated independently.

The public demo intentionally has no login so visitors can try the idea and its usability. SQL validation rejects writes and deletes, and accepted queries run inside a PostgreSQL read-only transaction. Model requests can include schema metadata and all loaded result values from the demonstration data. See [public demo and read-only safeguards](./security.md) and [Transport and APIs](./transport-api.md) for details.

## Source map

| Area                       | Source                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| App shell and routes       | [App Router](../src/app/), [AppEntry](../src/components/query/AppEntry.tsx)                       |
| Workspace and views        | [Query components](../src/components/query/)                                                      |
| Hooks                      | [UI hooks](../src/hooks/)                                                                         |
| Browser services           | [Client helpers](../src/lib/client/)                                                              |
| Agent and tools            | [Server agent](../src/lib/server/agent/)                                                          |
| Database and SQL policy    | [Database services](../src/lib/server/database/)                                                  |
| Transport                  | [Socket/server helpers](../src/lib/server/transport/)                                             |
| API adapters               | [HTTP handlers](../src/pages/api/), [platform stream route](../src/app/api/agent/stream/route.ts) |
| Shared logic and contracts | [Shared helpers](../src/lib/shared/), [types](../src/types/)                                      |
| Prompt content             | [Agent prompts](../src/lib/server/agent/prompts/)                                                 |
| Tests and fixtures         | [Test suites](../tests/)                                                                          |

## Supporting project files

`compose.yaml` provides local PostgreSQL datasets. `scripts/seed-database.ts` and `scripts/seed.sql` provision the ecommerce demo schema/data; `scripts/populate-test-db.sql` initializes or replaces the banking demo dataset. These scripts are setup tools, not part of request handling. `public/` contains static assets, and `src/app/favicon.ico` is the app icon. `.vscode/` contains development tasks and launch configurations. `next.config.ts` controls production file tracing and parser bundling.
