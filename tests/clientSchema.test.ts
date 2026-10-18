import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
let loadDatabaseSchema: typeof import("../src/lib/client/clientSchema").loadDatabaseSchema;
let moduleId = 0;
beforeEach(async () => {
  ({ loadDatabaseSchema } = await import(
    `../src/lib/client/clientSchema.ts?test=${moduleId++}`
  ));
});

const connected = { tables: [] };

test("concurrent page mounts share a single schema read", async () => {
  const methods: string[] = [];
  const fetch = mock.method(
    globalThis,
    "fetch",
    async (_url: string | URL | Request, options?: RequestInit) => {
      methods.push(options?.method ?? "GET");
      assert.equal(String(_url), "/api/database/schema");
      return Response.json(connected);
    },
  );
  try {
    const first = loadDatabaseSchema();
    const second = loadDatabaseSchema();
    assert.equal(first, second);
    assert.deepEqual(await first, connected);
    assert.deepEqual(await second, connected);
    assert.deepEqual(methods, ["GET"]);
  } finally {
    fetch.mock.restore();
  }
});

test("schema reads do not create browser sessions", async () => {
  const fetch = mock.method(globalThis, "fetch", async () =>
    Response.json(connected),
  );
  try {
    assert.deepEqual(await loadDatabaseSchema(), connected);
    assert.equal(fetch.mock.callCount(), 1);
  } finally {
    fetch.mock.restore();
  }
});

test("requests during a schema load share the pending fetch without queuing a refresh", async () => {
  const methods: string[] = [];
  let release: () => void = () => {};
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fetch = mock.method(
    globalThis,
    "fetch",
    async (_url: string | URL | Request, options?: RequestInit) => {
      methods.push(options?.method ?? "GET");
      if (methods.length === 1) await wait;
      assert.equal(options?.body, undefined);
      return Response.json(connected);
    },
  );
  try {
    const read = loadDatabaseSchema();
    const refresh = loadDatabaseSchema(true);
    const secondRefresh = loadDatabaseSchema(true);
    assert.equal(refresh, read);
    assert.equal(secondRefresh, read);
    release();
    await Promise.all([read, refresh, secondRefresh]);
    assert.deepEqual(methods, ["GET"]);
  } finally {
    fetch.mock.restore();
  }
});

test("malformed schema responses are rejected", async () => {
  const fetch = mock.method(globalThis, "fetch", async () =>
    Response.json({ connected: true, tables: [{}] }),
  );
  try {
    await assert.rejects(loadDatabaseSchema(), /Invalid database schema/);
  } finally {
    fetch.mock.restore();
  }
});

test("HTTP failures do not fall back to POST and proxy HTML gives a readable error", async () => {
  const fetch = mock.method(
    globalThis,
    "fetch",
    async () => new Response("Bad gateway", { status: 502 }),
  );
  try {
    await assert.rejects(loadDatabaseSchema(), /Request failed \(502\)/);
    assert.equal(fetch.mock.callCount(), 1);
  } finally {
    fetch.mock.restore();
  }
});

test("successful reads stay in memory until refresh and failed refresh preserves the cache", async () => {
  let fail = false;
  const methods: string[] = [];
  const fetch = mock.method(
    globalThis,
    "fetch",
    async (_url: string | URL | Request, options?: RequestInit) => {
      methods.push(options?.method ?? "GET");
      if (fail) throw new Error("offline");
      return Response.json(connected);
    },
  );
  try {
    const first = await loadDatabaseSchema();
    assert.equal(await loadDatabaseSchema(), first);
    assert.deepEqual(methods, ["GET"]);
    const refreshed = await loadDatabaseSchema(true);
    assert.notEqual(refreshed, first);
    assert.equal(await loadDatabaseSchema(), refreshed);
    fail = true;
    await assert.rejects(loadDatabaseSchema(true), /offline/);
    assert.equal(await loadDatabaseSchema(), refreshed);
    assert.deepEqual(methods, ["GET", "POST", "POST"]);
  } finally {
    fetch.mock.restore();
  }
});
