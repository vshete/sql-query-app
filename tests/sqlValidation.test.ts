import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanAndValidateSql } from "../src/lib/server/database/sqlValidation";

test("validates joins, quoted identifiers, CTEs and nested queries", () => {
  assert.deepEqual(
    cleanAndValidateSql(
      'SELECT * FROM "customers" c JOIN orders o ON c.customer_id = o.customer_id;',
    ).tables,
    ["customers", "orders"],
  );
  assert.deepEqual(
    cleanAndValidateSql(
      "WITH totals AS (SELECT * FROM orders) SELECT * FROM totals",
    ).tables,
    ["orders"],
  );
  assert.deepEqual(
    cleanAndValidateSql("SELECT * FROM (SELECT * FROM products) p").tables,
    ["products"],
  );
  assert.deepEqual(
    cleanAndValidateSql(
      "SELECT 'DELETE; DROP TABLE' AS label FROM customers -- UPDATE\n;",
    ).tables,
    ["customers"],
  );
});

test("accepts arbitrary tables when no schema allowlist is supplied", () => {
  assert.deepEqual(
    cleanAndValidateSql("SELECT * FROM travel.bookings").tables,
    ["travel.bookings"],
  );
});

test("checks tables against an explicitly supplied schema allowlist", () => {
  const allowedTables = new Set(["orders"]);
  assert.deepEqual(
    cleanAndValidateSql("SELECT * FROM orders", allowedTables).tables,
    ["orders"],
  );
  for (const sql of [
    "SELECT * FROM secrets",
    "SELECT * FROM orders, secrets",
    "SELECT * FROM secrets WHERE EXISTS (WITH secrets AS (SELECT * FROM orders) SELECT * FROM secrets)",
  ])
    assert.throws(() => cleanAndValidateSql(sql, allowedTables), sql);
});

test("rejects invalid SQL, multiple statements and writes", () => {
  for (const sql of [
    "SELEC * FROM customers",
    "SELECT * FROM customers; SELECT * FROM orders",
    "DELETE FROM customers",
    "SELECT * INTO copy FROM customers",
    "WITH removed AS (DELETE FROM orders RETURNING *) SELECT * FROM removed",
    "SELECT * FROM customers FOR UPDATE",
  ])
    assert.throws(() => cleanAndValidateSql(sql), sql);
});
