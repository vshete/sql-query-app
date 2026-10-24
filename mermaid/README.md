# Query Studio, explained visually

Each diagram answers one question in plain language. Read the main path first; dashed arrows add a related feature or an exception. Function names and implementation details live in the [documentation](../docs/README.md).

All 17 diagrams use Excalidraw's hand-drawn styling. The links below open scalable SVGs; matching double-resolution PNGs and editable `.excalidraw` scenes are in [`rendered/`](./rendered/). The older Mermaid SVG renders have been replaced.

For workflows, **follow the numbers on the connectors**, starting at **1**. Subnumbers such as **1.a / 1.b** identify branches or smaller steps; follow the arrow and its condition. A branch may finish early. Supporting relationships, live updates, and optional actions have descriptive labels instead of numbers. Boxes name the action or component. The architecture and result-usage maps show relationships rather than a fixed sequence.

## Start here

| What you want to understand           | View the diagram                                                   | Copy the Mermaid text                  | PNG | Editable scene |
| ------------------------------------- | ------------------------------------------------------------------ | -------------------------------------- | --- | --- |
| The basic idea in four steps          | [At a glance](./rendered/00-at-a-glance.svg)                       | [Source](./00-at-a-glance.mmd)         | [PNG](./rendered/00-at-a-glance.png) | [Edit](./rendered/00-at-a-glance.excalidraw) |
| How the whole app fits together       | [Whole app](./rendered/00-overall.svg)                             | [Source](./00-overall.mmd)             | [PNG](./rendered/00-overall.png) | [Edit](./rendered/00-overall.excalidraw) |
| What happens during one data question | [Step-by-step conversation](./rendered/08-end-to-end-sequence.svg) | [Source](./08-end-to-end-sequence.mmd) | [PNG](./rendered/08-end-to-end-sequence.png) | [Edit](./rendered/08-end-to-end-sequence.excalidraw) |

You do not need to read every diagram. Use the topic views below when a particular part needs explanation.

## Choose a topic

| Question                                          | View the diagram                                                         | Copy the Mermaid text                      | PNG | Editable scene |
| ------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------ | --- | --- |
| Where does each part of the app run?              | [Architecture](./rendered/01-architecture.svg)                           | [Source](./01-architecture.mmd)            | [PNG](./rendered/01-architecture.png) | [Edit](./rendered/01-architecture.excalidraw) |
| What can I see and do in the workspace?           | [The screen](./rendered/02-frontend.svg)                                 | [Source](./02-frontend.mmd)                | [PNG](./rendered/02-frontend.png) | [Edit](./rendered/02-frontend.excalidraw) |
| How does AI decide, query, and explain?           | [AI assistant](./rendered/03-query-agent.svg)                            | [Source](./03-query-agent.mmd)             | [PNG](./rendered/03-query-agent.png) | [Edit](./rendered/03-query-agent.excalidraw) |
| How is database access controlled?                | [Database](./rendered/04-database.svg)                                   | [Source](./04-database.mmd)                | [PNG](./rendered/04-database.png) | [Edit](./rendered/04-database.excalidraw) |
| How do requests and responses travel?             | [Communication](./rendered/05-transport-api.svg)                         | [Source](./05-transport-api.mmd)           | [PNG](./rendered/05-transport-api.png) | [Edit](./rendered/05-transport-api.excalidraw) |
| How does the public demo prevent database writes? | [Read-only safeguards](./rendered/06-security.svg)                       | [Source](./06-security.mmd)                | [PNG](./rendered/06-security.png) | [Edit](./rendered/06-security.excalidraw) |
| How do we start and check the app?                | [Running the app](./rendered/07-testing-operations.svg)                  | [Source](./07-testing-operations.mmd)      | [PNG](./rendered/07-testing-operations.png) | [Edit](./rendered/07-testing-operations.excalidraw) |
| What happens when work is interrupted?            | [Cancellation and errors](./rendered/09-cancellation-lifecycle.svg)      | [Source](./09-cancellation-lifecycle.mmd)  | [PNG](./rendered/09-cancellation-lifecycle.png) | [Edit](./rendered/09-cancellation-lifecycle.excalidraw) |
| When is the table list reused or refreshed?       | [Saved table lists](./rendered/10-schema-cache-sequence.svg)             | [Source](./10-schema-cache-sequence.mmd)   | [PNG](./rendered/10-schema-cache-sequence.png) | [Edit](./rendered/10-schema-cache-sequence.excalidraw) |
| How do results, follow-ups, and exports differ?   | [Using a result](./rendered/11-results-and-history.svg)                  | [Source](./11-results-and-history.mmd)     | [PNG](./rendered/11-results-and-history.png) | [Edit](./rendered/11-results-and-history.excalidraw) |
| What guides the AI, and which model runs?         | [AI instructions and models](./rendered/12-prompts-and-models.svg)       | [Source](./12-prompts-and-models.mmd)      | [PNG](./rendered/12-prompts-and-models.png) | [Edit](./rendered/12-prompts-and-models.excalidraw) |
| How does the agent handle several chat turns?     | [Multi-turn conversation](./rendered/13-multi-turn-query-agent.svg)      | [Source](./13-multi-turn-query-agent.mmd)  | [PNG](./rendered/13-multi-turn-query-agent.png) | [Edit](./rendered/13-multi-turn-query-agent.excalidraw) |
| What happens inside the MCP tools?                | [MCP tool lifecycle](./rendered/14-mcp-tool-lifecycle.svg)               | [Source](./14-mcp-tool-lifecycle.mmd)      | [PNG](./rendered/14-mcp-tool-lifecycle.png) | [Edit](./rendered/14-mcp-tool-lifecycle.excalidraw) |
| What is enforced, and what limits remain?         | [Agent safeguards and limits](./rendered/15-agent-safety-and-limits.svg) | [Source](./15-agent-safety-and-limits.mmd) | [PNG](./rendered/15-agent-safety-and-limits.png) | [Edit](./rendered/15-agent-safety-and-limits.excalidraw) |

## Query agent and MCP: read these three together

1. **[Multi-turn conversation](./rendered/13-multi-turn-query-agent.svg):** follow an initial data question and three possible follow-up paths: explain earlier results, ask for clarification, or fetch fresh data. Each turn starts with fresh server state; the browser supplies the conversation memory.
2. **[MCP tool lifecycle](./rendered/14-mcp-tool-lifecycle.svg):** follow one database turn through tool selection, the in-memory MCP bridge, schema-aware generation, validation, exact-query execution, and an optional explanation. The sequence shows where the AI provider and PostgreSQL participate.
3. **[Agent safeguards and limits](./rendered/15-agent-safety-and-limits.svg):** read four independent panels for request checks, SQL checks, resource/failure limits, and remaining answer/privacy boundaries. Purple and green describe enforced checks; amber describes limits or prompt guidance. Color is only a reading aid.

These are vector SVG images: open them at full size and zoom to read the detailed sequences.

The [illustrated MCP flow guide](../docs/mcp-flow.md) embeds all three diagrams and explains them with follow-up examples, tool responsibilities, safety checks, practical limits, and source links. See the [agent implementation guide](../docs/query-agent.md) for component contracts and provider configuration.

## A few useful terms

- **App server:** the part of the app that handles requests and talks to the database and AI provider.
- **SQL:** the database query prepared from a question.
- **Schema:** the list of tables and columns the app can read.
- **Cache:** a saved copy that avoids repeating work, such as loading the table list.
- **WebSocket:** the live connection that delivers updates while an answer is being prepared.
- **Loaded rows:** the rows returned for a question, capped at 1,000. Sorting and paging do not fetch additional matches.

Blue boxes show the workspace or a user-visible response, purple shows app/AI work, green shows data, and amber adds a limit or exception. Labels carry the meaning; color is only a reading aid. Numbered sequence arrows show time order, and dashed returns show replies.

## Scope and accuracy

The short overview shows a typical successful database question. The topic views cover the other paths: an answer without SQL, query errors, summary warnings, cancellation, schema refresh, and the separate HTTP APIs.

A few distinctions matter across the set:

- Cancelling a turn signals work to stop; an active database query may continue until it finishes or times out.
- If only the result explanation fails, the successful table can still be shown.
- Result explanations, tables, and snapshot CSV use all loaded rows, up to 1,000. Follow-up history keeps all rows per retained turn; its 40-message/120,000-character budget removes whole turns, never subsets of rows. See the [implementation links](../README.md#result-rows-sent-to-the-model).
- Browser CSV exports the loaded rows. The separate CSV API executes a new query.
- The demo intentionally has no login. SQL validation and PostgreSQL read-only transactions protect its query path; demonstration data can be sent to the AI provider.

The [architecture](../docs/architecture.md), [frontend](../docs/frontend.md), [agent](../docs/query-agent.md), [database](../docs/database.md), [API](../docs/transport-api.md), [demo safeguards](../docs/security.md), and [operations](../docs/testing-operations.md) guides provide the technical detail behind these views.

## Copy or update a diagram

Copy an entire `.mmd` file into a Mermaid-compatible tool. The files contain raw Mermaid text, with their own styles and accessible descriptions. Labels use plain text without HTML tags for compatibility across renderers. For Markdown, place that text inside a fenced code block labeled `mermaid`.

The `.mmd` files are the source of truth. Their Mermaid configuration selects the hand-drawn look; the Excalidraw renderer converts their shapes, arrows, text, and sequence messages into editable scene elements. The SVG exports embed the Virgil font and preserve each source's accessibility title and description. Each source has three outputs:

- `<name>.svg`: scalable diagram used by these READMEs and the documentation.
- `<name>.png`: portable image exported at twice the logical size.
- `<name>.excalidraw`: scene you can open in Excalidraw to edit individual elements. Regenerating from Mermaid replaces scene edits.

Regenerate the entire library from the repository root using the shared [local renderer](../writeup/tools/render-excalidraw.mjs):

```bash
npm install --prefix /tmp/query-excalidraw-render --cache /tmp/query-excalidraw-npm-cache --ignore-scripts --no-audit --no-fund @excalidraw/excalidraw@0.18.1 @excalidraw/mermaid-to-excalidraw@2.3.0 puppeteer-core@25.16.0 esbuild@0.28.2
node writeup/tools/render-excalidraw.mjs /tmp/query-excalidraw-render/node_modules mermaid mermaid/rendered
```

The renderer needs Chrome at `/usr/bin/google-chrome` (or `CHROME_PATH`), permission to launch it, and a loopback listener. After package installation, it runs locally with external browser requests blocked; no Excalidraw account or API key is needed. It uses standard Mermaid geometry for conversion, then applies Excalidraw strokes. Sequence exports repeat participants at the bottom because the converter needs both ends of each lifeline. The original message order, branches, and notes remain intact.

In this Codex environment the loopback listener requires elevated execution. Chrome uses `--no-sandbox` for container compatibility, so the renderer is intended for trusted local sources.

Validated on October 23, 2026: all 17 diagrams exported as native editable elements, with no embedded-image fallback. Source node labels, all 58 numbered sequence messages, sequence notes, embedded fonts, accessibility metadata, double-resolution PNG dimensions, and documentation links were checked. Layout-only connectors remain invisible. The renderer includes compatibility fixes for prefixed Mermaid subgraph IDs and sequence numbering in converter 2.3.0.

The presentation pass uses [measured text layout](../writeup/tools/polish-diagrams.mjs): consistent card typography, wider spacing, independently placed connector captions with opaque backings, dedicated panel headers, and square self-call loops. Notes and captions render above lifelines. Alternate branch conditions receive their own note ribbons so the converter cannot drop them. Each export checks every text rectangle for overlap with other text and for crossings of card boundaries; a collision fails rendering. All 17 refreshed diagrams passed these checks and were reviewed visually, including sections of the long sequences.

Keep each view focused: short labels, one clear reading direction, and only the decisions needed to explain its topic. Put new implementation detail in the companion guide instead of expanding the diagram into a function map.
