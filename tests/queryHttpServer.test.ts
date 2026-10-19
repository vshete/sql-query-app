import next from "next";
import assert from "node:assert/strict";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { Duplex } from "node:stream";
import { test } from "node:test";
import { createQueryHttpServer } from "../src/lib/server/transport/queryHttpServer";

test("Next's lazy upgrade setup cannot close query sockets and still receives HMR", async () => {
  const nextUpgradeServer = createServer();
  const app = next({ dev: true, httpServer: nextUpgradeServer });
  const forwarded: string[] = [];
  // Stub route compilation, but use the installed NextCustomServer's real
  // getRequestHandler/setupWebSocketHandler implementation.
  Object.assign(app, {
    init: {
      requestHandler: async () => {},
      upgradeHandler: (req: IncomingMessage, socket: Duplex) => {
        forwarded.push(req.url!);
        socket.end();
      },
    },
  });
  const server = createQueryHttpServer(
    app.getRequestHandler(),
    nextUpgradeServer,
  );
  const writes: string[] = [];
  const socket = new Duplex({
    read() {},
    write(chunk, _encoding, callback) {
      writes.push(chunk.toString());
      callback();
    },
  });
  const req = new IncomingMessage(socket as never);
  req.method = "GET";
  req.url = "/api/agent/stream";
  req.headers = {
    host: "localhost:3000",
    origin: "http://localhost:3000",
    upgrade: "websocket",
    "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
    "sec-websocket-version": "13",
  };
  // Next discovers the public server through req.socket.server unless the
  // separate httpServer option is supplied. Reproduce the first page request.
  Object.assign(socket, { server });
  try {
    server.emit("request", req, new ServerResponse(req));
    assert.equal(server.listenerCount("upgrade"), 1);
    assert.equal(nextUpgradeServer.listenerCount("upgrade"), 1);
    server.emit("upgrade", req, socket, Buffer.alloc(0));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.match(writes.join(""), /101 Switching Protocols/);
    assert.equal(socket.writableEnded, false);
    assert.equal(socket.destroyed, false);
    assert.deepEqual(forwarded, []);

    req.url = "/_next/hmr";
    server.emit("upgrade", req, socket, Buffer.alloc(0));
    assert.deepEqual(forwarded, ["/_next/hmr"]);
  } finally {
    socket.destroy();
  }
});
