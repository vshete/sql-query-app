import next from "next";
import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { getAgentConfig } from "./src/app/services/agentConfig";
import {
  connectionIdFromCookie,
  getDatabaseConnection,
} from "./src/app/services/databaseConnections";
import { configureMockModelMode } from "./src/app/services/mocks/mockMode";
import { runQueryAgent } from "./src/app/services/queryAgent";

async function main() {
  const dev = process.env.NODE_ENV !== "production";
  configureMockModelMode(dev);
  const port = Number(process.env.PORT || 3000);
  const app = next({ dev, port });
  await app.prepare();
  const server = createServer(app.getRequestHandler());
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  const nextUpgrade = app.getUpgradeHandler();

  server.on("upgrade", (req, socket, head) => {
    if (req.url?.split("?")[0] !== "/api/agent/stream") {
      void nextUpgrade(req, socket, head);
      return;
    }
    // Browsers must connect from the same host; prevent cross-site agent requests.
    try {
      if (
        !req.headers.origin ||
        new URL(req.headers.origin).host !== req.headers.host
      ) {
        socket.destroy();
        return;
      }
    } catch {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  });

  wss.on("connection", (ws, req) => {
    const controller = new AbortController();
    let started = false;
    const deadline = setTimeout(() => {
      send({ type: "error", error: "Query generation timed out." });
      controller.abort();
      ws.close();
    }, 180_000);
    function send(event: unknown) {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
    }
    ws.on("close", () => {
      clearTimeout(deadline);
      controller.abort();
    });
    ws.on("error", () => controller.abort());
    ws.on("message", async (data) => {
      if (started) return;
      started = true;
      try {
        const payload = JSON.parse(data.toString());
        if (
          typeof payload.request !== "string" ||
          !payload.request.trim() ||
          payload.request.length > 10_000
        ) {
          throw new Error("A request of 1–10000 characters is required.");
        }
        const { database } = getDatabaseConnection(
          connectionIdFromCookie(req.headers.cookie),
        );
        const { provider, apiKey, model } = getAgentConfig();
        const result = await runQueryAgent(
          payload.request.trim(),
          provider,
          apiKey,
          model,
          {
            database,
            signal: controller.signal,
            onSqlStart: () => send({ type: "sql_start" }),
            onToken: (token) => send({ type: "token", token }),
            onAgentToken: (token) => send({ type: "agent_token", token }),
          },
        );
        send({ type: "result", result });
      } catch (error) {
        send({
          type: "error",
          error: error instanceof Error ? error.message : "Query agent failed.",
        });
      } finally {
        clearTimeout(deadline);
        ws.close();
      }
    });
  });
  server.listen(port, () =>
    console.log(`Query app listening on http://localhost:${port}`),
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
