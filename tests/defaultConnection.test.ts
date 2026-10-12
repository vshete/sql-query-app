import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { loadDefaultConnection } from "../src/app/services/defaultConnection";

const connected = { connected: true, label: "default", tables: [] };

test("concurrent page mounts share a single default connection request", async () => {
  const methods: string[] = [];
  const fetch = mock.method(
    globalThis,
    "fetch",
    async (_url: string | URL | Request, options?: RequestInit) => {
      methods.push(options?.method ?? "GET");
      return Response.json(
        options?.method === "POST" ? connected : { connected: false },
      );
    },
  );
  try {
    const first = loadDefaultConnection();
    const second = loadDefaultConnection();
    assert.equal(first, second);
    assert.deepEqual(await first, connected);
    assert.deepEqual(await second, connected);
    assert.deepEqual(methods, ["GET", "POST"]);
  } finally {
    fetch.mock.restore();
  }
});

test("an existing browser session is reused without reconnecting", async () => {
  const fetch = mock.method(globalThis, "fetch", async () =>
    Response.json(connected),
  );
  try {
    assert.deepEqual(await loadDefaultConnection(), connected);
    assert.equal(fetch.mock.callCount(), 1);
  } finally {
    fetch.mock.restore();
  }
});

test("expired sessions reconnect and a failed connection can be retried", async () => {
  let attempts = 0;
  const fetch = mock.method(
    globalThis,
    "fetch",
    async (_url: string | URL | Request, options?: RequestInit) => {
      if (!options?.method)
        return Response.json({ error: "Session expired" }, { status: 400 });
      return ++attempts === 1
        ? Response.json({ error: "Database unavailable" }, { status: 400 })
        : Response.json(connected);
    },
  );
  try {
    await assert.rejects(loadDefaultConnection(), /Database unavailable/);
    assert.deepEqual(await loadDefaultConnection(), connected);
    assert.equal(attempts, 2);
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
      if (options?.method === "POST")
        assert.deepEqual(JSON.parse(String(options.body)), { refresh: true });
      return Response.json(connected);
    },
  );
  try {
    const read = loadDefaultConnection();
    const refresh = loadDefaultConnection(true);
    const secondRefresh = loadDefaultConnection(true);
    release();
    await Promise.all([read, refresh, secondRefresh]);
    assert.deepEqual(methods, ["GET", "GET", "POST"]);
  } finally {
    fetch.mock.restore();
  }
});

test("malformed successful connection responses never enable querying", async () => {
  const fetch = mock.method(globalThis, "fetch", async () =>
    Response.json({ connected: true, tables: [{}] }),
  );
  try {
    await assert.rejects(
      loadDefaultConnection(),
      /Invalid database connection/,
    );
  } finally {
    fetch.mock.restore();
  }
});

test("HTTP failures do not fall back to connection creation and proxy HTML gives a readable error", async () => {
  const fetch = mock.method(
    globalThis,
    "fetch",
    async () => new Response("Bad gateway", { status: 502 }),
  );
  try {
    await assert.rejects(loadDefaultConnection(), /Request failed \(502\)/);
    assert.equal(fetch.mock.callCount(), 1);
  } finally {
    fetch.mock.restore();
  }
});
