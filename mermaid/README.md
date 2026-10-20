# Query Studio, explained visually

Each diagram answers one question in plain language. Read the main path first; dashed arrows add a related feature or an exception. Function names and implementation details live in the [documentation](../docs/README.md).

For workflows, **follow the numbers on the connectors**, starting at **1**. Subnumbers such as **1.a / 1.b** identify branches or smaller steps; follow the arrow and its condition. A branch may finish early. Supporting relationships, live updates, and optional actions have descriptive labels instead of numbers. Boxes name the action or component. The architecture and result-usage maps show relationships rather than a fixed sequence.

## Start here

| What you want to understand           | View the diagram                                                   | Copy the Mermaid text                  |
| ------------------------------------- | ------------------------------------------------------------------ | -------------------------------------- |
| The basic idea in four steps          | [At a glance](./rendered/00-at-a-glance.svg)                       | [Source](./00-at-a-glance.mmd)         |
| How the whole app fits together       | [Whole app](./rendered/00-overall.svg)                             | [Source](./00-overall.mmd)             |
| What happens during one data question | [Step-by-step conversation](./rendered/08-end-to-end-sequence.svg) | [Source](./08-end-to-end-sequence.mmd) |

You do not need to read every diagram. Use the topic views below when a particular part needs explanation.

## Choose a topic

| Question                                        | View the diagram                                                    | Copy the Mermaid text                     |
| ----------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------- |
| Where does each part of the app run?            | [Architecture](./rendered/01-architecture.svg)                      | [Source](./01-architecture.mmd)           |
| What can I see and do in the workspace?         | [The screen](./rendered/02-frontend.svg)                            | [Source](./02-frontend.mmd)               |
| How does AI decide, query, and explain?         | [AI assistant](./rendered/03-query-agent.svg)                       | [Source](./03-query-agent.mmd)            |
| How is database access controlled?              | [Database](./rendered/04-database.svg)                              | [Source](./04-database.mmd)               |
| How do requests and responses travel?           | [Communication](./rendered/05-transport-api.svg)                    | [Source](./05-transport-api.mmd)          |
| How does the public demo prevent database writes? | [Read-only safeguards](./rendered/06-security.svg)                              | [Source](./06-security.mmd)               |
| How do we start and check the app?              | [Running the app](./rendered/07-testing-operations.svg)             | [Source](./07-testing-operations.mmd)     |
| What happens when work is interrupted?          | [Cancellation and errors](./rendered/09-cancellation-lifecycle.svg) | [Source](./09-cancellation-lifecycle.mmd) |
| When is the table list reused or refreshed?     | [Saved table lists](./rendered/10-schema-cache-sequence.svg)        | [Source](./10-schema-cache-sequence.mmd)  |
| How do results, follow-ups, and exports differ? | [Using a result](./rendered/11-results-and-history.svg)             | [Source](./11-results-and-history.mmd)    |
| What guides the AI, and which model runs?       | [AI instructions and models](./rendered/12-prompts-and-models.svg)  | [Source](./12-prompts-and-models.mmd)     |

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

The `.mmd` files are the editable originals; [`rendered/`](./rendered/) contains their SVG previews. With Mermaid CLI installed, regenerate a changed preview from the repository root:

```bash
mmdc -i mermaid/00-overall.mmd -o mermaid/rendered/00-overall.svg
```

Keep each view focused: short labels, one clear reading direction, and only the decisions needed to explain its topic. Put new implementation detail in the companion guide instead of expanding the diagram into a function map.
