import next from "next";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { handleQuerySocket } from "./src/app/services/querySocket";
import { initializeDatabase } from "./src/app/services/databaseInitialization";
import { configureMockModelMode } from "./src/app/services/mocks/mockMode";
import { isSameHostOrigin } from "./src/app/services/requestOrigin";
import { MAX_REQUEST_PAYLOAD_BYTES } from "./src/app/types/queryProtocol";

async function main() {
  const dev = process.env.NODE_ENV !== "production";
  configureMockModelMode(dev);
  const port = Number(process.env.PORT || 3000);
  const app = next({ dev, port });
  await app.prepare();
  await initializeDatabase();
  const server = createServer(app.getRequestHandler());
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_REQUEST_PAYLOAD_BYTES,
  });
  const nextUpgrade = app.getUpgradeHandler();

  server.on("upgrade", (req, socket, head) => {
    if (req.url?.split("?")[0] !== "/api/agent/stream") {
      void nextUpgrade(req, socket, head);
      return;
    }
    // Browsers must connect from the same host; prevent cross-site agent requests.
    if (
      !req.headers.origin ||
      !isSameHostOrigin(req.headers.origin, req.headers.host)
    ) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  });

  wss.on("connection", handleQuerySocket);

  server.listen(port, () =>
    console.log(`Query app listening on http://localhost:${port}`),
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
