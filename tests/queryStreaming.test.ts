import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Sequelize, type QueryOptions } from "sequelize";
import { mockDatabaseClient, transactionQuery } from "./databaseMock";
mock.method(
  Sequelize.prototype,
  "query",
  async (sql: string, options?: QueryOptions) => {
    if (options?.transaction) return transactionQuery(sql, options);
    return [
      "customers",
      "orders",
      "products",
      "order_details",
      "employees",
      "categories",
    ].map((name) => ({
      schema: "public",
      name,
      columns: [
        { name: "id", type: "integer", nullable: false, default: null },
      ],
      constraints: [],
    }));
  },
);

process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
mockDatabaseClient(async () => ({
  query: async (query: string | { text: string }) => {
    const sql = typeof query === "string" ? query : query.text;
    return sql.startsWith("FETCH")
      ? { rows: [{ id: 1 }], fields: [{ name: "id" }] }
      : { rows: [], fields: [] };
  },
  release: () => {},
}));
import { runQueryAgent } from "../src/app/services/queryAgent";

test("request cancellation preserves its reason without logging a SQL failure", async () => {
  const controller = new AbortController();
  const reason = new DOMException("Query connection closed before completion.", "AbortError");
  controller.abort(reason);
  const errors = mock.method(console, "error", () => {});
  try {
    await assert.rejects(
      runQueryAgent("List customers", "openai", "test-key", "test", {
        signal: controller.signal,
      }),
      (error: unknown) => error === reason,
    );
    assert.equal(errors.mock.callCount(), 0);
  } finally {
    errors.mock.restore();
  }
});

test("SQL and agent chunks arrive before their responses finish, through MCP", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const sqlTokens: string[] = [];
  const agentTokens: string[] = [];
  let completed = false;
  const encoder = new TextEncoder();
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(
      body.stream,
      true,
      "all model calls should request provider streaming",
    );
    calls++;
    const current = calls;
    let deltas: unknown[];
    assert.deepEqual(
      (body.tools ?? [])
        .map((entry: { function: { name: string } }) => entry.function.name)
        .sort(),
      current === 2
        ? []
        : current === 1
          ? ["construct_sql"]
          : ["execute_query"],
    );
    if (current === 1 || current === 3) {
      const name = current === 1 ? "construct_sql" : "execute_query";
      const args =
        current === 1
          ? { request: "List customers" }
          : { query: "SELECT * FROM customers;" };
      deltas = [
        { content: "Working. " },
        {
          tool_calls: [
            {
              index: 0,
              id: `call-${current}`,
              type: "function",
              function: { name, arguments: JSON.stringify(args) },
            },
          ],
        },
      ];
    } else if (current === 2) {
      deltas = [{ content: "SELECT " }, { content: "* FROM customers;" }];
    } else {
      assert.fail("No model call should happen after execution succeeds");
    }
    return new Response(
      new ReadableStream({
        async start(controller) {
          for (let i = 0; i < deltas.length; i++) {
            const chunk = {
              id: `chat-test-${current}`,
              object: "chat.completion.chunk",
              created: 1,
              model: "test",
              choices: [
                {
                  index: 0,
                  delta: {
                    ...(i === 0 ? { role: "assistant" } : {}),
                    ...(deltas[i] as object),
                  },
                  finish_reason: null,
                },
              ],
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
            );
            // Keep the provider response open. Callbacks must fire before completion.
            await new Promise((resolve) => setTimeout(resolve, 50));
            if (i === 0 && current === 2)
              assert.deepEqual(sqlTokens, ["SELECT "]);
            if (i === 0 && current === 1)
              assert.deepEqual(agentTokens, ["Working. "]);
            assert.equal(completed, false);
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      }),
      { headers: { "content-type": "text/event-stream" } },
    );
  };
  try {
    const result = await runQueryAgent(
      "List customers",
      "openai",
      "test-key",
      "test",
      {
        onToken: (token) => sqlTokens.push(token),
        onAgentToken: (token) => agentTokens.push(token),
      },
    );
    completed = true;
    assert.equal(calls, 3);
    assert.equal(result.generatedSQL, sqlTokens.join(""));
    assert.equal(agentTokens.join(""), "Working. Working. ");
    assert.equal(result.queryResult.rowCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("concurrent requests reuse MCP initialization and isolate their models and callbacks", async () => {
  const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
  const originalConnect = McpServer.prototype.connect;
  const originalFetch = globalThis.fetch;
  McpServer.prototype.connect = async () => {
    assert.fail(
      "the MCP server should already be initialized by the preceding request",
    );
  };
  const calls = new Map<string, number>();
  const encoder = new TextEncoder();
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    const table = body.model;
    assert.ok(["customers", "products"].includes(table));
    const current = (calls.get(table) ?? 0) + 1;
    calls.set(table, current);
    const sql = `SELECT * FROM ${table};`;
    const delta =
      current === 1 || current === 3
        ? {
            tool_calls: [
              {
                index: 0,
                id: `${table}-${current}`,
                type: "function",
                function: {
                  name: current === 1 ? "construct_sql" : "execute_query",
                  arguments: JSON.stringify(
                    current === 1
                      ? { request: `List ${table}` }
                      : { query: sql },
                  ),
                },
              },
            ],
          }
        : { content: current === 2 ? sql : `Found ${table}.` };
    assert.ok(current <= 3);
    return new Response(
      new ReadableStream({
        async start(controller) {
          // Interleave provider responses from both requests.
          await new Promise((resolve) => setTimeout(resolve, 10));
          const chunk = {
            id: `${table}-${current}`,
            object: "chat.completion.chunk",
            created: 1,
            model: table,
            choices: [
              {
                index: 0,
                delta: { role: "assistant", ...delta },
                finish_reason: null,
              },
            ],
          };
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`,
            ),
          );
          controller.close();
        },
      }),
      { headers: { "content-type": "text/event-stream" } },
    );
  };
  try {
    await Promise.all(
      ["customers", "products"].map(async (table) => {
        const sqlTokens: string[] = [];
        const agentTokens: string[] = [];
        let sqlStarts = 0;
        const result = await runQueryAgent(
          `List ${table}`,
          "openai",
          `key-${table}`,
          table,
          {
            onToken: (token) => sqlTokens.push(token),
            onAgentToken: (token) => agentTokens.push(token),
            onSqlStart: () => {
              sqlStarts++;
            },
          },
        );
        assert.equal(result.generatedSQL, `SELECT * FROM ${table};`);
        assert.deepEqual(result.requiredTables, [table]);
        assert.equal(result.queryResult.rowCount, 1);
        assert.equal(sqlTokens.join(""), result.generatedSQL);
        assert.equal(agentTokens.join(""), "");
        assert.equal(sqlStarts, 1);
        assert.equal(calls.get(table), 3);
      }),
    );
  } finally {
    globalThis.fetch = originalFetch;
    McpServer.prototype.connect = originalConnect;
  }
});

for (const provider of ["openai", "gemini"] as const) {
  test(`${provider}: a rate limit fails once without retrying or restarting SQL`, async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    let starts = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response(
        JSON.stringify({
          error: {
            code: 429,
            message: "Rate limit reached",
            type: "rate_limit_error",
            status: "RESOURCE_EXHAUSTED",
          },
        }),
        { status: 429, headers: { "content-type": "application/json" } },
      );
    };
    try {
      await assert.rejects(
        runQueryAgent("List customers", provider, "test-key", "test", {
          onSqlStart: () => {
            starts++;
          },
        }),
        /429|Rate limit/,
      );
      assert.equal(calls, 1);
      assert.equal(starts, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}

function toolDelta(names: string[]) {
  return {
    tool_calls: names.map((name, index) => ({
      index,
      id: randomUUID(),
      type: "function",
      function: {
        name,
        arguments: JSON.stringify(
          name === "execute_query"
            ? { query: "SELECT * FROM customers;" }
            : { request: "List customers" },
        ),
      },
    })),
  };
}

function streamResponse(delta: object) {
  const chunk = {
    id: randomUUID(),
    object: "chat.completion.chunk",
    created: 1,
    model: "test",
    choices: [
      { index: 0, delta: { role: "assistant", ...delta }, finish_reason: null },
    ],
  };
  return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`, {
    headers: { "content-type": "text/event-stream" },
  });
}

for (const duplicateBatch of [false, true]) {
  test(`repeated tool calls reuse SQL and database results (${duplicateBatch ? "parallel batch" : "later turn"})`, async () => {
    const originalFetch = globalThis.fetch;
    const dbConnect = mockDatabaseClient();
    let modelCalls = 0;
    let generations = 0;
    let starts = 0;
    const tokens: string[] = [];
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      if (!body.tools?.length) {
        generations++;
        return streamResponse({ content: "SELECT * FROM customers;" });
      }
      modelCalls++;
      assert.ok(modelCalls <= 3, "the agent must stop after execution");
      if (modelCalls === 1) {
        return streamResponse(
          toolDelta(
            duplicateBatch
              ? ["construct_sql", "construct_sql"]
              : ["construct_sql"],
          ),
        );
      }
      if (!duplicateBatch && modelCalls === 2)
        return streamResponse(toolDelta(["construct_sql"]));
      // Put construct_sql last to exercise the completion guard with a successful result earlier in the batch.
      return streamResponse(
        toolDelta(
          duplicateBatch
            ? ["execute_query", "execute_query", "construct_sql"]
            : ["execute_query"],
        ),
      );
    };
    try {
      const result = await runQueryAgent(
        "List customers",
        "openai",
        "test-key",
        "test",
        {
          onSqlStart: () => {
            starts++;
          },
          onToken: (token) => tokens.push(token),
        },
      );
      assert.equal(result.generatedSQL, "SELECT * FROM customers;");
      assert.equal(result.queryResult.rowCount, 1);
      assert.equal(generations, 1);
      assert.equal(starts, 1);
      assert.equal(tokens.join(""), result.generatedSQL);
      assert.equal(dbConnect.mock.callCount(), 1);
      assert.equal(modelCalls, duplicateBatch ? 2 : 3);
    } finally {
      globalThis.fetch = originalFetch;
      dbConnect.mock.restore();
    }
  });
}

test("an agent that keeps requesting construction hits the model budget without regenerating SQL", async () => {
  const originalFetch = globalThis.fetch;
  let modelCalls = 0;
  let generations = 0;
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    if (!body.tools?.length) {
      generations++;
      return streamResponse({ content: "SELECT * FROM customers;" });
    }
    modelCalls++;
    assert.ok(modelCalls <= 4, "no provider request beyond the budget");
    return streamResponse(toolDelta(["construct_sql"]));
  };
  try {
    await assert.rejects(
      runQueryAgent("List customers", "openai", "test-key", "test"),
      /Query agent model call limit reached/,
    );
    assert.equal(modelCalls, 4);
    assert.equal(generations, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a rate limit during SQL generation fails without restarting the agent or SQL stream", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let starts = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return streamResponse(toolDelta(["construct_sql"]));
    return new Response(
      JSON.stringify({
        error: { message: "Rate limit reached", type: "rate_limit_error" },
      }),
      {
        status: 429,
        headers: { "content-type": "application/json" },
      },
    );
  };
  try {
    await assert.rejects(
      runQueryAgent("List customers", "openai", "test-key", "test", {
        onSqlStart: () => {
          starts++;
        },
      }),
      /429|Rate limit/,
    );
    assert.equal(calls, 2);
    assert.equal(starts, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a database failure stops without more model calls", async () => {
  const originalFetch = globalThis.fetch;
  const connect = mockDatabaseClient(async () => {
    throw new Error("Database unavailable");
  });
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    assert.ok(calls <= 3);
    return streamResponse(
      calls === 2
        ? { content: "SELECT * FROM customers;" }
        : toolDelta([calls === 1 ? "construct_sql" : "execute_query"]),
    );
  };
  try {
    await assert.rejects(
      runQueryAgent("List customers", "openai", "test-key", "test"),
      /Database unavailable/,
    );
    assert.equal(calls, 3);
    assert.equal(connect.mock.callCount(), 1);
  } finally {
    globalThis.fetch = originalFetch;
    connect.mock.restore();
  }
});

test("follow-up context reaches both agent and SQL generator, with a grounded text summary", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const agentTokens: string[] = [];
  const history = [
    { role: "user" as const, content: "List defaulting customers" },
    {
      role: "assistant" as const,
      content: JSON.stringify({
        sql: "SELECT * FROM customers;",
        sampleRows: [{ id: 1 }],
      }),
    },
  ];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    calls++;
    for (const message of history) {
      assert.ok(
        body.messages.some(
          (entry: { role: string; content: string }) =>
            entry.role === message.role && entry.content === message.content,
        ),
        `history missing from call ${calls}`,
      );
    }
    if (calls === 4) {
      assert.ok(body.messages.at(-1).content.includes('"rowCount":1'));
      assert.ok(body.messages.at(-1).content.includes('"sampleRows":[{"id":1}]'));
      assert.match(body.messages[0].content, /human-readable answer/);
      assert.match(body.messages[0].content, /tabulated results/);
      assert.match(body.messages[0].content, /sampled or truncated/);
      return streamResponse({
        content: "The query returned one matching customer.",
      });
    }
    return streamResponse(
      calls === 2
        ? { content: "SELECT * FROM customers;" }
        : toolDelta([calls === 1 ? "construct_sql" : "execute_query"]),
    );
  };
  try {
    const result = await runQueryAgent(
      "For this, show customer names",
      "openai",
      "test-key",
      "test",
      { history, summarizeResults: true, onAgentToken: (token) => agentTokens.push(token) },
    );
    assert.equal(calls, 4);
    assert.equal(result.queryResult.rowCount, 1);
    assert.equal(
      result.explanation,
      "The query returned one matching customer.",
    );
    assert.equal(agentTokens.join(""), "\n\nThe query returned one matching customer.");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an optional summary failure preserves the successfully executed table", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 4) throw new Error("Summary unavailable");
    return streamResponse(
      calls === 2
        ? { content: "SELECT * FROM customers;" }
        : toolDelta([calls === 1 ? "construct_sql" : "execute_query"]),
    );
  };
  try {
    const result = await runQueryAgent(
      "List customers",
      "openai",
      "test-key",
      "test",
      { summarizeResults: true },
    );
    assert.equal(result.queryResult.rowCount, 1);
    assert.ok(
      result.warnings.some((warning) => warning.includes("text summary")),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
