import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { QueryTypes, Sequelize } from "sequelize";
import { executeDatabaseQuery } from "../src/lib/server/database/database";
import { mockDatabaseClient, transactionQuery } from "./databaseMock";
mock.method(Sequelize.prototype, "query", transactionQuery);

process.env.DATABASE_URL = "postgresql://test:test@localhost/test";

test("executes validated SQL in a read-only transaction and caps returned rows", async () => {
  const calls: string[] = [];
  let released = false;
  const connect = mockDatabaseClient(async () => ({
    query: async (query: string | { text: string }) => {
      const sql = typeof query === "string" ? query : query.text;
      calls.push(sql);
      return {
        fields: [{ name: "order_id" }],
        rows: sql.startsWith("FETCH")
          ? Array.from({ length: 1001 }, (_, i) => ({ order_id: i }))
          : [],
      };
    },
    release: () => {
      released = true;
    },
  }));
  try {
    const result = await executeDatabaseQuery(
      "SELECT order_id FROM orders ORDER BY order_id",
    );
    assert.ok(calls.includes("SET TRANSACTION READ ONLY"));
    assert.ok(calls.includes("FETCH FORWARD 1001 FROM query_result"));
    assert.equal(calls.at(-1), "COMMIT;");
    assert.equal(result.rowCount, 1000);
    assert.equal(result.truncated, true);
    assert.equal(result.rows[999].order_id, 999);
    assert.deepEqual(result.columns, ["order_id"]);
    assert.equal(released, true);
  } finally {
    connect.mock.restore();
  }
});

test("database errors roll back and release the connection", async () => {
  const calls: string[] = [];
  let released = false;
  const connect = mockDatabaseClient(async () => ({
    query: async (query: string | { text: string }) => {
      const sql = typeof query === "string" ? query : query.text;
      calls.push(sql);
      if (sql.startsWith("DECLARE")) throw new Error("column does not exist");
      return { rows: [], fields: [] };
    },
    release: () => {
      released = true;
    },
  }));
  try {
    await assert.rejects(
      executeDatabaseQuery("SELECT missing FROM customers"),
      /column does not exist/,
    );
    assert.equal(calls.at(-1), "ROLLBACK;");
    assert.equal(released, true);
  } finally {
    connect.mock.restore();
  }
});

test("empty results retain column metadata", async () => {
  const connect = mockDatabaseClient(async () => ({
    query: async () => ({ rows: [], fields: [{ name: "customer_id" }] }),
    release: () => {},
  }));
  try {
    const result = await executeDatabaseQuery(
      "SELECT customer_id FROM customers WHERE false",
    );
    assert.deepEqual(result.columns, ["customer_id"]);
    assert.deepEqual(result.rows, []);
    assert.equal(result.truncated, false);
  } finally {
    connect.mock.restore();
  }
});

test("writes and already-aborted requests never open a connection", async () => {
  const connect = mockDatabaseClient(() => {
    throw new Error("unexpected connection");
  });
  try {
    await assert.rejects(
      executeDatabaseQuery("DELETE FROM customers"),
      /read-only/,
    );
    await assert.rejects(
      executeDatabaseQuery("SELECT * FROM customers", AbortSignal.abort()),
    );
    assert.equal(connect.mock.callCount(), 0);
  } finally {
    connect.mock.restore();
  }
});

test(
  "live PostgreSQL: seed is repeatable, joins and aggregates return real rows",
  {
    skip: !process.env.DATABASE_TEST_URL,
  },
  async () => {
    mock.restoreAll();
    const { readFile } = await import("node:fs/promises");
    const database = new Sequelize(process.env.DATABASE_TEST_URL!, {
      logging: false,
    });
    try {
      await database.transaction(async (transaction) => {
        const seed = await readFile("scripts/seed.sql", "utf8");
        await database.query(seed, { transaction });
        await database.query(seed, { transaction });
        const count = await database.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM public.orders WHERE order_id BETWEEN 10001 AND 11000",
          { transaction, type: QueryTypes.SELECT },
        );
        assert.equal(count[0].count, 1000);
        const details = await database.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM public.order_details WHERE order_id BETWEEN 10001 AND 11000",
          { transaction, type: QueryTypes.SELECT },
        );
        assert.equal(details[0].count, 3000);
        const joined = await database.query(
          "SELECT o.order_id, c.country, SUM(d.unit_price*d.quantity*(1-d.discount)) AS total FROM public.orders o JOIN public.customers c USING(customer_id) JOIN public.order_details d USING(order_id) GROUP BY o.order_id,c.country ORDER BY o.order_id LIMIT 5",
          { transaction, type: QueryTypes.SELECT },
        );
        assert.equal(joined.length, 5);
      });
      const result = await executeDatabaseQuery(
        "SELECT * FROM customers WHERE false",
        undefined,
        database,
      );
      assert.equal(result.rowCount, 0);
      assert.ok(result.columns.includes("customer_id"));
    } finally {
      await database.close();
    }
  },
);

test("SQL and CSV endpoints execute against the server pool without a browser connection cookie", async () => {
  const { default: queryHandler } = await import("../src/pages/api/post/query");
  const { default: downloadHandler } =
    await import("../src/pages/api/post/download");
  const connect = mockDatabaseClient(async () => ({
    query: async (query: string | { text: string }) => {
      const sql = typeof query === "string" ? query : query.text;
      return {
        fields: [{ name: "customer_id" }],
        rows: sql.startsWith("FETCH") ? [{ customer_id: 42 }] : [],
      };
    },
    release: () => {},
  }));
  try {
    for (const handler of [queryHandler, downloadHandler]) {
      let status = 200;
      let result: unknown;
      const response = {
        setHeader() {},
        status(code: number) {
          status = code;
          return response;
        },
        json(value: unknown) {
          result = value;
          return response;
        },
        send(value: unknown) {
          result = value;
          return response;
        },
      };
      await handler(
        {
          method: "POST",
          body: { query: "SELECT customer_id FROM customers" },
          headers: {},
        } as import("next").NextApiRequest,
        response as unknown as import("next").NextApiResponse,
      );
      assert.equal(status, 200);
      if (handler === queryHandler) {
        assert.deepEqual((result as { rows: unknown[] }).rows, [
          { customer_id: 42 },
        ]);
      } else {
        assert.equal(result, '"customer_id"\r\n"42"');
      }
    }
  } finally {
    connect.mock.restore();
  }
});
