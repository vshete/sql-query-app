import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { Sequelize } from "sequelize";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "../pages/api/database/connection";
import {
  connectDatabase,
  disconnectDatabase,
  getDatabaseConnection,
} from "../src/app/services/databaseConnections";
import { getDatabase } from "../src/app/services/database";

async function request(method: string, body?: unknown, cookie?: string) {
  const headers = new Map<string, unknown>();
  let status = 200;
  let result: Record<string, unknown> = {};
  const response = {
    setHeader(name: string, value: unknown) {
      headers.set(name, value);
    },
    status(code: number) {
      status = code;
      return response;
    },
    json(value: Record<string, unknown>) {
      result = value;
      return response;
    },
  };
  await handler(
    { method, body, headers: { cookie } } as NextApiRequest,
    response as unknown as NextApiResponse,
  );
  return { status, result, headers };
}

test("default connection uses only the server URL and preserves schema refresh/disconnect", async () => {
  const previous = process.env.DATABASE_URL;
  const serverUrl =
    "postgresql://server:private@neon-example.test/neondb?sslmode=require";
  process.env.DATABASE_URL = serverUrl;
  const tables = [
    {
      schema: "public",
      name: "customers",
      columns: [
        { name: "id", type: "integer", nullable: false, default: null },
      ],
      constraints: [],
    },
  ];
  const query = mock.method(
    Sequelize.prototype,
    "query",
    async function (this: Sequelize) {
      assert.equal(this.config.host, "neon-example.test");
      return tables;
    },
  );
  let cookie: string | undefined;
  try {
    const connected = await request("POST", {
      connectionString: "postgresql://other:other@untrusted.test/other",
    });
    assert.equal(connected.status, 200);
    assert.equal(connected.result.connected, true);
    assert.deepEqual(connected.result.tables, tables);
    assert.equal(JSON.stringify(connected.result).includes("private"), false);
    cookie = String(connected.headers.get("Set-Cookie")).split(";")[0];
    const loaded = await request("GET", undefined, cookie);
    assert.deepEqual(loaded.result.tables, tables);
    assert.equal(query.mock.callCount(), 1);
    await request("POST", { refresh: true }, cookie);
    assert.equal(query.mock.callCount(), 2);
    assert.deepEqual((await request("DELETE", undefined, cookie)).result, {
      connected: false,
    });
    cookie = undefined;
    assert.deepEqual((await request("GET")).result, { connected: false });
  } finally {
    if (cookie) await request("DELETE", undefined, cookie);
    query.mock.restore();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});

test("a missing server URL cannot be replaced by a browser-supplied URL", async () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const response = await request("POST", {
      connectionString: "postgresql://other:other@example.test/db",
    });
    assert.equal(response.status, 400);
    assert.match(String(response.result.error), /Set DATABASE_URL/);
  } finally {
    if (previous !== undefined) process.env.DATABASE_URL = previous;
  }
});

test("concurrent sessions share the default Sequelize instance and disconnect independently", async () => {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL =
    "postgresql://server:private@neon-example.test/neondb?sslmode=require";
  const query = mock.method(Sequelize.prototype, "query", async () => []);
  const end = mock.method(Sequelize.prototype, "close", async () => {});
  const ids: string[] = [];
  try {
    const sessions = await Promise.all([connectDatabase(), connectDatabase()]);
    ids.push(...sessions.map((session) => session.id));
    assert.notEqual(sessions[0].id, sessions[1].id);
    assert.equal(
      sessions[0].connection.database,
      sessions[1].connection.database,
    );
    assert.equal(sessions[0].connection.database, getDatabase());

    await disconnectDatabase(sessions[0].id);
    assert.throws(() => getDatabaseConnection(sessions[0].id), /expired/);
    const remaining = getDatabaseConnection(sessions[1].id);
    await remaining.database.query("SELECT 1");
    await disconnectDatabase(sessions[1].id);
    assert.equal(end.mock.callCount(), 0);

    const reconnected = await connectDatabase();
    ids.push(reconnected.id);
    assert.equal(reconnected.connection.database, remaining.database);
  } finally {
    await Promise.all(ids.map(disconnectDatabase));
    query.mock.restore();
    end.mock.restore();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});

test("a schema failure does not close the shared Sequelize instance and can be retried", async () => {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL =
    "postgresql://server:private@neon-example.test/neondb?sslmode=require";
  const { getDatabaseSchema } =
    await import("../src/app/services/databaseSchema");
  const query = mock.method(Sequelize.prototype, "query", async () => []);
  const end = mock.method(Sequelize.prototype, "close", async () => {});
  let id: string | undefined;
  try {
    // Expire the shared schema cache so the next connection reads it again.
    const schema = await getDatabaseSchema();
    schema.fetchedAt = 0;
    query.mock.restore();
    const failingQuery = mock.method(Sequelize.prototype, "query", async () => {
      throw new Error("Database unavailable");
    });
    await assert.rejects(
      connectDatabase(),
      /Could not connect or read the schema/,
    );
    assert.equal(end.mock.callCount(), 0);
    failingQuery.mock.restore();
    mock.method(Sequelize.prototype, "query", async () => []);
    const session = await connectDatabase();
    id = session.id;
    assert.equal(session.connection.database, getDatabase());
  } finally {
    await disconnectDatabase(id);
    mock.restoreAll();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});

test("database instances are reused by URL and isolated when the server URL changes", () => {
  const previous = process.env.DATABASE_URL;
  const firstUrl = "postgresql://one:private@first.test/db";
  const secondUrl = "postgresql://two:private@second.test/db";
  try {
    process.env.DATABASE_URL = firstUrl;
    const first = getDatabase();
    process.env.DATABASE_URL = secondUrl;
    const second = getDatabase();
    assert.notEqual(first, second);
    assert.equal(second.config.host, "second.test");
    process.env.DATABASE_URL = firstUrl;
    assert.equal(getDatabase(), first);
    assert.equal(getDatabase(secondUrl), second);
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});
