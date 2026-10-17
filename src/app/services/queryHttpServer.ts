import { createServer, type RequestListener, type Server } from "node:http";
import { WebSocketServer } from "ws";
import { MAX_REQUEST_PAYLOAD_BYTES } from "../types/queryProtocol";
import { handleQuerySocket } from "./querySocket";
import { isSameHostOrigin } from "./requestOrigin";

/** Keep query upgrades exclusively owned by ws, including after Next's lazy setup. */
export function createQueryHttpServer(
  handleRequest: RequestListener,
  nextUpgradeServer: Server,
) {
  const server = createServer(handleRequest);
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_REQUEST_PAYLOAD_BYTES,
  });

  server.on("upgrade", (req, socket, head) => {
    if (req.url?.split("?")[0] !== "/api/agent/stream") {
      if (!nextUpgradeServer.emit("upgrade", req, socket, head))
        socket.destroy();
      return;
    }
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
  return server;
}
