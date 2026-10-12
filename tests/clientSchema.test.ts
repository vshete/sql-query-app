import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { loadDatabaseSchema } from "../src/app/services/clientSchema";

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

test("schema refresh survives an in-flight status read and concurrent refreshes are deduplicated", async () => {
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
    release();
    await Promise.all([read, refresh, secondRefresh]);
    assert.deepEqual(methods, ["GET", "POST"]);
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
