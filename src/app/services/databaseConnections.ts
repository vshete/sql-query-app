import { randomUUID } from "node:crypto";
import type { Sequelize } from "sequelize";
import { getDatabase } from "./database";
import { getDatabaseSchema } from "./databaseSchema";

interface Connection {
  database: Sequelize;
  label: string;
  touchedAt: number;
}

const state = globalThis as typeof globalThis & {
  queryAppConnections?: Map<string, Connection>;
  queryAppConnectionCleanup?: ReturnType<typeof setInterval>;
};

const connections = (state.queryAppConnections ??= new Map());
export const CONNECTION_COOKIE = "query_app_connection";
const SESSION_TTL = 60 * 60_000;
const MAX_ACTIVE_SESSIONS = 1000;
const cleanup = (state.queryAppConnectionCleanup ??= setInterval(() => {
  for (const [id, connection] of connections) {
    if (Date.now() - connection.touchedAt > SESSION_TTL)
      void disconnectDatabase(id);
  }
}, 60_000));
cleanup.unref();

export function connectionIdFromCookie(cookie?: string) {
  return cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CONNECTION_COOKIE}=`))
    ?.slice(CONNECTION_COOKIE.length + 1);
}

export function getDatabaseConnection(id?: string): Connection {
  const connection = id ? connections.get(id) : undefined;
  if (!connection || Date.now() - connection.touchedAt > SESSION_TTL) {
    if (id) void disconnectDatabase(id);
    throw new Error(
      "Connect to PostgreSQL first. Your connection may have expired.",
    );
  }
  connection.touchedAt = Date.now();
  return connection;
}

/**
 * This was designed to connect to multiple databses but currently only connecting to one db  
 */
export async function connectDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (typeof connectionString !== "string" || connectionString.length > 4096)
    throw new Error("Enter a PostgreSQL connection URL.");
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("Enter a valid PostgreSQL connection URL.");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    !url.pathname.slice(1)
  ) {
    throw new Error("Use postgresql://user:password@host:port/database.");
  }
  if (connections.size >= MAX_ACTIVE_SESSIONS)
    throw new Error("Too many active sessions. Try again later.");
  const database = getDatabase(connectionString);
  try {
    const schema = await getDatabaseSchema(database);
    const id = randomUUID();
    const connection = {
      database,
      label: `${url.hostname}:${url.port || "5432"}${url.pathname}`,
      touchedAt: Date.now(),
    };
    connections.set(id, connection);
    return { id, connection, schema };
  } catch {
    throw new Error(
      "Could not connect or read the schema. Check the URL, credentials, network access, and SELECT permissions.",
    );
  }
}

export async function disconnectDatabase(id?: string) {
  if (!id) return;
  // Sessions do not own the shared database; other requests may still be using it.
  connections.delete(id);
}
