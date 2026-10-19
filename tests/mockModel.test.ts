import assert from "node:assert/strict";
import { mock, test } from "node:test";
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

import { getAgentConfig } from "../src/lib/server/agent/agentConfig";
import {
  configureMockModelMode,
  isMockModelEnabled,
} from "../src/lib/server/agent/mocks/mockMode";
import {
  MOCK_SUMMARY,
  MockQueryChatModel,
} from "../src/lib/server/agent/mocks/mockQueryChatModel";
import { MOCK_SQL } from "../src/lib/server/agent/modelFactory";
import { runQueryAgent } from "../src/lib/server/agent/queryAgent";

function saveEnvironment() {
  const saved = { ...process.env };
  const argv = [...process.argv];
  return () => {
    for (const key of Object.keys(process.env))
      if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    process.argv = argv;
  };
}

test("mock startup supports CLI and npm flags and never enables production mocking", () => {
  const restore = saveEnvironment();
  try {
    Object.assign(process.env, { NODE_ENV: "development" });
    delete process.env.npm_config_mockModel;
    delete process.env.npm_config_mockmodel;
    process.argv = ["node", "server.ts", "--mockModel"];
    configureMockModelMode(true);
    assert.equal(isMockModelEnabled(), true);
    process.argv = ["node", "server.ts"];
    configureMockModelMode(true);
    assert.equal(isMockModelEnabled(), false);
    for (const key of ["npm_config_mockModel", "npm_config_mockmodel"]) {
      process.env[key] = "true";
      configureMockModelMode(true);
      assert.equal(isMockModelEnabled(), true);
      delete process.env[key];
    }
    process.argv.push("--mockModel");
    configureMockModelMode(false);
    assert.equal(isMockModelEnabled(), false);
    process.env.QUERY_APP_MOCK_MODEL = "true";
    Object.assign(process.env, { NODE_ENV: "production" });
    assert.equal(isMockModelEnabled(), false);
  } finally {
    restore();
  }
});

test("mock requests stream identical SQL without provider calls and execute through PostgreSQL", async () => {
  const restore = saveEnvironment();
  process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
  const statements: string[] = [];
  const bindTools = mock.method(MockQueryChatModel.prototype, "bindTools");
  const connect = mockDatabaseClient(async () => ({
    query: async (query: string | { text: string }) => {
      const text = typeof query === "string" ? query : query.text;
      statements.push(text);
      return text.startsWith("FETCH")
        ? {
            rows: [{ customer_id: "REAL_DB_ROW" }],
            fields: [{ name: "customer_id" }],
          }
        : { rows: [], fields: [] };
    },
    release: () => {},
  }));
  const fetch = mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected provider call");
  });
  try {
    Object.assign(process.env, { NODE_ENV: "development" });
    process.env.QUERY_APP_MOCK_MODEL = "true";
    process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
    process.env.AI_PROVIDER = "unused-in-mock-mode";
    const { provider, apiKey, model } = getAgentConfig();
    assert.equal(apiKey, "");
    await Promise.all(
      ["List customers", "Show revenue by product"].map(async (request) => {
        let started = 0;
        const tokens: string[] = [];
        const agentTokens: string[] = [];
        const tokenTimes: number[] = [];
        const result = await runQueryAgent(request, provider, apiKey, model, {
          summarizeResults: request === "List customers",
          onAgentToken: (token) => agentTokens.push(token),
          onSqlStart: () => {
            started++;
          },
          onToken: (token) => {
            tokens.push(token);
            tokenTimes.push(performance.now());
          },
        });
        assert.equal(result.generatedSQL, MOCK_SQL);
        assert.equal(tokens.join(""), MOCK_SQL);
        assert.ok(tokens.length > 1, "SQL arrives in multiple chunks");
        assert.ok(
          tokenTimes.at(-1)! - tokenTimes[0] >= 1_000,
          "SQL chunks arrive gradually",
        );
        assert.equal(started, 1);
        assert.deepEqual(result.requiredTables, ["customers"]);
        assert.deepEqual(result.queryResult!.rows, [
          { customer_id: "REAL_DB_ROW" },
        ]);
        if (request === "List customers") {
          assert.equal(result.explanation, MOCK_SUMMARY);
          assert.equal(agentTokens.join(""), `\n\n${MOCK_SUMMARY}`);
          assert.ok(
            agentTokens.length > 2,
            "summary arrives in multiple chunks",
          );
        } else {
          assert.equal(agentTokens.join(""), "");
          assert.match(result.explanation, /Generated using a mock model/);
        }
      }),
    );
    assert.equal(fetch.mock.callCount(), 0);
    assert.deepEqual(
      bindTools.mock.calls
        .map((call) => call.arguments[0].map((tool) => tool.name))
        .sort(),
      [
        ["construct_sql", "execute_query"],
        ["construct_sql", "execute_query"],
        ["construct_sql", "execute_query"],
        ["construct_sql", "execute_query"],
      ],
      "the agent exposes both MCP tools at every step",
    );
    assert.equal(connect.mock.callCount(), 2);
    assert.equal(
      statements.filter(
        (text) =>
          text === `DECLARE query_result NO SCROLL CURSOR FOR ${MOCK_SQL}`,
      ).length,
      2,
    );
    connect.mock.mockImplementation(async () => {
      throw new Error("Database unavailable");
    });
    await assert.rejects(
      runQueryAgent("Anything", provider, apiKey, model),
      /Database unavailable/,
    );
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      runQueryAgent("Anything", provider, apiKey, model, {
        signal: controller.signal,
      }),
      /abort/i,
    );
  } finally {
    bindTools.mock.restore();
    connect.mock.restore();
    fetch.mock.restore();
    restore();
  }
});
