import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { WebSocket } from "ws";
import { GET } from "../src/app/api/agent/stream/route";
import { handleQuerySocket } from "../src/app/services/querySocket";

test("the deployed route rejects missing/cross-site origins and ordinary HTTP", async () => {
  for (const origin of [undefined, "https://other.example"]) {
    const response = await GET(
      new Request("https://query.example/api/agent/stream", {
        headers: { host: "query.example", ...(origin ? { origin } : {}) },
      }),
    );
    assert.equal(response.status, 403);
  }
  const response = await GET(
    new Request("https://query.example/api/agent/stream", {
      headers: { host: "query.example", origin: "https://query.example" },
    }),
  );
  assert.equal(response.status, 426);
});

test("the shared socket handler returns an error and closes for an invalid request", async () => {
  const socket = new EventEmitter();
  const messages: unknown[] = [];
  const closed = new Promise<void>((resolve) => socket.once("close", resolve));
  Object.assign(socket, {
    readyState: WebSocket.OPEN,
    send: (value: string) => messages.push(JSON.parse(value)),
    close: () => socket.emit("close"),
  });
  handleQuerySocket(socket as WebSocket);
  socket.emit("message", Buffer.from(JSON.stringify({ request: "" })));
  await closed;
  assert.deepEqual(messages, [
    { type: "error", error: "A request of 1–10000 characters is required." },
  ]);
});
