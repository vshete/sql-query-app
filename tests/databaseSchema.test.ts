import assert from "node:assert/strict";
import { test } from "node:test";
import type { Sequelize } from "sequelize";
import { getDatabaseSchema } from "../src/app/services/databaseSchema";
import { cleanAndValidateSql } from "../src/app/services/sqlValidation";

const table = {
  schema: "analytics",
  name: "events",
  columns: [
    {
      name: "created_at",
      type: "timestamp with time zone",
      nullable: false,
      default: "now()",
    },
    { name: "kind", type: "text", nullable: true, default: null },
  ],
  constraints: ["PRIMARY KEY (created_at, kind)"],
};

test("schema cache deduplicates concurrent fetches, refreshes, and isolates pools", async () => {
  let calls = 0;
  const pool = {
    query: async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return [table];
    },
  } as unknown as Sequelize;
  const [first, second] = await Promise.all([
    getDatabaseSchema(pool),
    getDatabaseSchema(pool),
  ]);
  assert.equal(first, second);
  assert.equal(calls, 1);
  assert.equal(await getDatabaseSchema(pool), first);
  assert.equal(calls, 1);
  assert.match(first.text, /"analytics"\."events"/);
  assert.match(first.text, /PRIMARY KEY/);
  assert.ok(
    first.suggestions.some((suggestion) => suggestion.includes("created_at")),
  );
  await getDatabaseSchema(pool, true);
  assert.equal(calls, 2);
  const other = { query: async () => [] } as unknown as Sequelize;
  assert.deepEqual((await getDatabaseSchema(other)).suggestions, []);
});

test("failed schema fetches retry and cached schemas remain until explicit refresh", async () => {
  let calls = 0;
  const pool = {
    query: async () => {
      if (++calls === 1) throw new Error("offline");
      return [table];
    },
  } as unknown as Sequelize;
  await assert.rejects(getDatabaseSchema(pool), /offline/);
  const value = await getDatabaseSchema(pool);
  value.fetchedAt = Date.now() - 6 * 60_000;
  assert.equal(await getDatabaseSchema(pool), value);
  assert.equal(calls, 2);
  await getDatabaseSchema(pool, true);
  assert.equal(calls, 3);
});

test("dynamic table validation accepts qualified identifiers and rejects other tables and writes", () => {
  const allowed = new Set(["analytics.events"]);
  assert.deepEqual(
    cleanAndValidateSql('SELECT * FROM "analytics"."events"', allowed).tables,
    ["analytics.events"],
  );
  assert.throws(
    () => cleanAndValidateSql("SELECT * FROM public.events", allowed),
    /connected database schema/,
  );
  assert.throws(
    () => cleanAndValidateSql("DELETE FROM analytics.events", allowed),
    /read-only/,
  );
});

test("a failed explicit refresh preserves the last successful shared schema", async () => {
  let unavailable = false;
  const pool = {
    query: async () => {
      if (unavailable) throw new Error("offline");
      return [table];
    },
  } as unknown as Sequelize;
  const cached = await getDatabaseSchema(pool);
  unavailable = true;
  await assert.rejects(getDatabaseSchema(pool, true), /offline/);
  assert.equal(await getDatabaseSchema(pool), cached);
  unavailable = false;
  assert.notEqual(await getDatabaseSchema(pool, true), cached);
});

test("requests during an initial schema load share the pending query", async () => {
  let calls = 0;
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const querying = new Promise<void>((resolve) => {
    started = resolve;
  });
  const pool = {
    query: async () => {
      calls++;
      if (calls === 1) {
        started();
        await waiting;
      }
      return [table];
    },
  } as unknown as Sequelize;
  const read = getDatabaseSchema(pool);
  await querying;
  const refresh = getDatabaseSchema(pool, true);
  const secondRefresh = getDatabaseSchema(pool, true);
  release();
  const [initial, refreshed, duplicate] = await Promise.all([
    read,
    refresh,
    secondRefresh,
  ]);
  assert.equal(calls, 1);
  assert.equal(initial, refreshed);
  assert.equal(refreshed, duplicate);
  assert.equal(await getDatabaseSchema(pool), refreshed);
});
