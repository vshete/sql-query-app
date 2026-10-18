import next from "next";
import { createServer } from "node:http";
import { initializeDatabase } from "./src/lib/server/database/databaseInitialization";
import { configureMockModelMode } from "./src/lib/server/agent/mocks/mockMode";
import { createQueryHttpServer } from "./src/lib/server/transport/queryHttpServer";

/** Prepare Next.js and warm the database before opening the custom HTTP/WebSocket server. */
async function main() {
  const dev = process.env.NODE_ENV !== "production";
  configureMockModelMode(dev);
  const port = Number(process.env.PORT || 3000);
  // Next lazily installs an upgrade listener on its httpServer. Give it a
  // separate upgrade target so it cannot also end sockets accepted by wss.
  // This server never listens; non-query upgrades are forwarded to it below.
  const nextUpgradeServer = createServer();
  const app = next({ dev, port, httpServer: nextUpgradeServer });
  await app.prepare();
  await initializeDatabase();
  const server = createQueryHttpServer(app.getRequestHandler(), nextUpgradeServer);
  server.listen(port, () =>
    console.log(`Query app listening on http://localhost:${port}`),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
