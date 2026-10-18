# AI instructions

These Markdown files are loaded by `queryPrompts.ts` and passed to the models and tools by `queryAgent.ts`.

- `query-agent.md`: system instructions for coordinating the two tools.
- `sql-generation.md`: system instructions for generating SQL.
- `sql-request.md`: message template containing schema and user request data. Keep the `{{schema}}` and `{{request}}` placeholders.
- `construct-sql.md` and `execute-query.md`: descriptions exposed to the agent.
- `mcp-construct-sql.md` and `mcp-execute-query.md`: descriptions registered on the MCP server.

The entire file content is sent as the corresponding prompt or description; Markdown lists are supported. This README is not sent to the model. Schema and user request values are inserted as data, not loaded as system instructions.

Keep this prompt directory available at runtime. Database schema metadata comes from PostgreSQL and is cached in server memory. System prompts and agent descriptions are read for each request; restart the server after changing MCP descriptions, which are registered at initialization.
