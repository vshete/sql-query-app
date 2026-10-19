import type { NextApiRequest, NextApiResponse } from "next";
import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { Sequelize } from "sequelize";
import { getDatabase } from "../src/lib/server/database/database";
import { initializeDatabase } from "../src/lib/server/database/databaseInitialization";
import handler from "../src/pages/api/database/schema";

async function request(method: string, origin?: string) {
  const headers = new Map<string, unknown>();
  let status = 200;
  let result: unknown;
  const response = {
    setHeader(name: string, value: unknown) {
      headers.set(name, value);
    },
    status(code: number) {
      status = code;
      return response;
    },
    json(value: unknown) {
      result = value;
      return response;
    },
  };
  await handler(
    { method, headers: { origin, host: "localhost:3000" } } as NextApiRequest,
    response as unknown as NextApiResponse,
  );
  return { status, result, headers };
}

test("boot warms one shared pool; cookie-free page reads use cached schema and only POST refreshes", async () => {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://server:private@boot.test/db";
  const tables = [
    { schema: "public", name: "customers", columns: [], constraints: [] },
  ];
  const authenticate = mock.method(
    Sequelize.prototype,
    "authenticate",
    async () => {},
  );
  const query = mock.method(Sequelize.prototype, "query", async () => tables);
  try {
    await Promise.all([initializeDatabase(), initializeDatabase()]);
    assert.equal(authenticate.mock.callCount(), 1);
    assert.equal(query.mock.callCount(), 1);
    for (let i = 0; i < 3; i++) {
      const response = await request("GET");
      assert.equal(response.status, 200);
      assert.deepEqual(response.result, { tables });
      assert.equal(response.headers.has("Set-Cookie"), false);
      assert.equal(JSON.stringify(response.result).includes("private"), false);
    }
    assert.equal(query.mock.callCount(), 1);
    assert.equal((await request("POST")).status, 200);
    assert.equal(query.mock.callCount(), 2);
    assert.equal(authenticate.mock.callCount(), 1);
    assert.equal((await request("DELETE")).status, 405);
    assert.equal((await request("POST", "https://other.test")).status, 403);
    assert.equal(query.mock.callCount(), 2);
  } finally {
    mock.restoreAll();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});

test("boot retries a failed connection and shares the successful initialization", async () => {
  const database = new Sequelize("postgresql://server:private@retry.test/db", {
    logging: false,
  });
  let attempts = 0;
  mock.method(database, "authenticate", async () => {
    if (++attempts <= 3) throw new Error("offline");
  });
  mock.method(database, "query", async () => []);
  try {
    await Promise.all([
      initializeDatabase(database),
      initializeDatabase(database),
    ]);
    await initializeDatabase(database);
    assert.equal(attempts, 4);
  } finally {
    mock.restoreAll();
  }
});

test("boot stops after three retries and permits a later initialization", async () => {
  const database = new Sequelize(
    "postgresql://server:private@offline.test/db",
    {
      logging: false,
    },
  );
  const offline = new Error("offline");
  const authenticate = mock.method(database, "authenticate", async () => {
    throw offline;
  });
  const query = mock.method(database, "query", async () => []);
  try {
    await assert.rejects(
      initializeDatabase(database),
      (error) => error === offline,
    );
    assert.equal(authenticate.mock.callCount(), 4);
    assert.equal(query.mock.callCount(), 0);
    authenticate.mock.mockImplementation(async () => {});
    await initializeDatabase(database);
    assert.equal(authenticate.mock.callCount(), 5);
    assert.equal(query.mock.callCount(), 1);
  } finally {
    mock.restoreAll();
  }
});

test("missing server configuration fails without accepting a client URL", () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    assert.throws(() => getDatabase(), /Set DATABASE_URL/);
  } finally {
    if (previous !== undefined) process.env.DATABASE_URL = previous;
  }
});
