import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseAgentResult,
  parseQueryResult,
  parseSchemaInfo,
} from "../src/lib/client/clientValidation";
import {
  compareQueryValues,
  formatQueryValue,
  queryResultCsv,
} from "../src/lib/shared/queryResults";
import { streamQuery } from "../src/lib/client/queryStream";
import { isSameHostOrigin } from "../src/lib/server/transport/requestOrigin";
import type { QueryAgentResult } from "../src/types/query.types";
import {
  MAX_REQUEST_LENGTH,
  MAX_REQUEST_PAYLOAD_BYTES,
  MAX_STREAM_TEXT_LENGTH,
} from "../src/types/queryProtocol";

import {
  createTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
} from "@tanstack/react-table";
import { createResultColumns } from "../src/hooks/useQueryResultTable";

const result: QueryAgentResult = {
  generatedSQL: "SELECT id FROM orders;",
  explanation: "Done",
  requiredTables: ["orders"],
  warnings: [],
  queryResult: {
    columns: ["id"],
    rows: [{ id: 2 }],
    rowCount: 1,
    truncated: false,
    message: "Done",
  },
};

test("external data validation rejects nulls, invalid columns and inconsistent row counts", () => {
  assert.equal(parseAgentResult(result).queryResult!.rowCount, 1);
  assert.throws(() => parseSchemaInfo(null), /Invalid/);
  assert.throws(
    () => parseSchemaInfo({ connected: true, tables: [{ name: "broken" }] }),
    /Invalid/,
  );
  assert.throws(() => parseSchemaInfo({ connected: true }), /Invalid/);
  assert.throws(
    () => parseQueryResult({ ...result.queryResult, rows: [{ wrong: 1 }] }),
    /Invalid/,
  );
  assert.throws(
    () => parseQueryResult({ ...result.queryResult, rowCount: 20 }),
    /Invalid/,
  );
  assert.throws(
    () => parseQueryResult({ ...result.queryResult, rows: [{ id: {} }] }),
    /Invalid/,
  );
  assert.throws(
    () => parseQueryResult({ ...result.queryResult, rows: [{ id: Infinity }] }),
    /Invalid/,
  );
  assert.throws(
    () => parseAgentResult({ ...result, warnings: [null] }),
    /Invalid/,
  );
  assert.equal(
    parseQueryResult({
      ...result.queryResult,
      columns: ["a.b"],
      rows: [{ "a.b": null }],
    }).rows[0]["a.b"],
    null,
  );
});

test("results preserve numeric ordering and distinguish NULL, empty, false and zero", () => {
  assert.deepEqual([100, 2, 10].sort(compareQueryValues), [2, 10, 100]);
  assert.equal(compareQueryValues(false, true), -1);
  assert.deepEqual([null, "", false, 0].map(formatQueryValue), [
    "NULL",
    "",
    "false",
    "0",
  ]);
  const csv = queryResultCsv({
    columns: ["text", "amount"],
    rows: [
      { text: '=HYPERLINK("bad")', amount: -12 },
      { text: 'a,"b"\nc', amount: null },
      { text: "\t+cmd", amount: 0 },
    ],
    rowCount: 3,
    truncated: false,
    message: "Done",
  });
  assert.equal(
    csv,
    `"text","amount"\r\n"'=HYPERLINK(""bad"")","-12"\r\n"a,""b""\nc",""\r\n"'\t+cmd","0"`,
  );
});

class Socket {
  static latest: Socket;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;
  sent: string[] = [];
  constructor(public url: string) {
    Socket.latest = this;
  }
  send(value: string) {
    this.sent.push(value);
  }
  close() {
    this.closed = true;
  }
  emit(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) });
  }
}

function browser() {
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  const values = {
    window: { location: { protocol: "https:", host: "example.test" } },
    WebSocket: Socket,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame: (id: number) => {
      frames.delete(id);
    },
  };
  for (const [name, value] of Object.entries(values)) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  }
  return {
    frames,
    paint: () => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(0));
    },
    restore: () => {
      for (const [name, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
    },
  };
}

test("stream batches tokens per paint, preserves visible SQL, validates result and detaches handlers", async () => {
  const env = browser();
  try {
    const updates: string[][] = [];
    const pending = streamQuery("List orders", {
      signal: new AbortController().signal,
      onUpdate: (sql, answer) => updates.push([sql, answer]),
    });
    const socket = Socket.latest;
    assert.equal(socket.url, "wss://example.test/api/agent/stream");
    socket.onopen?.();
    assert.deepEqual(JSON.parse(socket.sent[0]), { request: "List orders" });
    socket.emit({ type: "token", token: "SELECT " });
    socket.emit({ type: "agent_token", token: "Working" });
    socket.emit({ type: "token", token: "id FROM orders" });
    assert.equal(updates.length, 0);
    assert.equal(env.frames.size, 1);
    env.paint();
    assert.deepEqual(updates, [["SELECT id FROM orders", "Working"]]);
    socket.emit({ type: "sql_start" });
    socket.emit({ type: "result", result });
    assert.equal((await pending) instanceof Object, true);
    assert.deepEqual(updates.at(-1), ["SELECT id FROM orders", "Working"]);
    assert.equal(socket.closed, true);
    assert.equal(socket.onmessage, null);
    assert.equal(socket.onclose, null);
    assert.equal(env.frames.size, 0);
  } finally {
    env.restore();
  }
});

test("abort settles a connecting socket and suppresses queued paint updates", async () => {
  const env = browser();
  try {
    for (const tokens of [false, true]) {
      const controller = new AbortController();
      let updates = 0;
      const pending = streamQuery("List orders", {
        signal: controller.signal,
        onUpdate: () => {
          updates++;
        },
      });
      const rejected = assert.rejects(pending, { name: "AbortError" });
      const socket = Socket.latest;
      if (tokens) socket.emit({ type: "token", token: "SELECT " });
      controller.abort();
      await rejected;
      env.paint();
      assert.equal(updates, 0);
      assert.equal(socket.closed, true);
      assert.equal(env.frames.size, 0);
    }
  } finally {
    env.restore();
  }
});

test("malformed, oversized and prematurely closed streams fail instead of resolving partial results", async () => {
  const env = browser();
  try {
    for (const message of [
      null,
      { type: "result", result: {} },
      { type: "token", token: 3 },
      { type: "unknown" },
      { type: "token", token: "x".repeat(MAX_STREAM_TEXT_LENGTH + 1) },
    ]) {
      const pending = streamQuery("List orders", {
        signal: new AbortController().signal,
        onUpdate: () => {},
      });
      const rejected = assert.rejects(pending, /Invalid response|size limit/);
      Socket.latest.emit(message);
      await rejected;
      assert.equal(Socket.latest.closed, true);
    }
    const pending = streamQuery("List orders", {
      signal: new AbortController().signal,
      onUpdate: () => {},
    });
    const rejected = assert.rejects(pending, /closed before completion/);
    Socket.latest.onclose?.();
    await rejected;
  } finally {
    env.restore();
  }
});

test("a result without token events uses final SQL and socket send errors reject promptly", async () => {
  const env = browser();
  try {
    const updates: string[] = [];
    const pending = streamQuery("List orders", {
      signal: new AbortController().signal,
      onUpdate: (sql) => updates.push(sql),
    });
    Socket.latest.emit({ type: "result", result });
    assert.deepEqual(await pending, result);
    assert.deepEqual(updates, [result.generatedSQL]);
    const failed = streamQuery("List orders", {
      signal: new AbortController().signal,
      onUpdate: () => {},
    });
    const rejected = assert.rejects(failed, /Could not send/);
    Socket.latest.send = () => {
      throw new Error("Socket closed");
    };
    Socket.latest.onopen?.();
    await rejected;
  } finally {
    env.restore();
  }
});

test("the actual result columns sort numeric aliases literally and paginate sorted loaded rows", () => {
  const table = createTable({
    columns: createResultColumns(["order.total"]),
    data: [{ "order.total": 100 }, { "order.total": 2 }, { "order.total": 10 }],
    state: {
      sorting: [{ id: "0", desc: false }],
      pagination: { pageIndex: 0, pageSize: 2 },
    },
    onStateChange: () => {},
    renderFallbackValue: null,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  assert.deepEqual(
    table.getSortedRowModel().rows.map((row) => row.getValue("0")),
    [2, 10, 100],
  );
  assert.deepEqual(
    table.getRowModel().rows.map((row) => row.getValue("0")),
    [2, 10],
  );
  assert.equal(table.getPageCount(), 2);
});

test("browser origin checks reject malformed, opaque, non-HTTP and different-host origins", () => {
  assert.equal(isSameHostOrigin("https://example.test", "example.test"), true);
  for (const origin of [
    "null",
    "bad-url",
    "https://other.test",
    "https://example.test:444",
    "ftp://example.test",
  ]) {
    assert.equal(isSameHostOrigin(origin, "example.test"), false);
  }
  assert.equal(isSameHostOrigin("https://example.test", undefined), false);
});

test("socket byte limits admit every supported prompt length including Unicode and JSON escapes", () => {
  for (const request of [
    "界".repeat(MAX_REQUEST_LENGTH),
    "😀".repeat(MAX_REQUEST_LENGTH / 2),
    "\u0000".repeat(MAX_REQUEST_LENGTH),
  ]) {
    assert.equal(request.length, MAX_REQUEST_LENGTH);
    assert.ok(
      new TextEncoder().encode(JSON.stringify({ request })).byteLength <=
        MAX_REQUEST_PAYLOAD_BYTES,
    );
  }
});
