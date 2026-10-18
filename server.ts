import next from "next";
import { createServer } from "node:http";
import { initializeDatabase } from "./src/app/services/databaseInitialization";
import { configureMockModelMode } from "./src/app/services/mocks/mockMode";
import { createQueryHttpServer } from "./src/app/services/queryHttpServer";

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
