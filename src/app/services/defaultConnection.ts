import type { ConnectionInfo } from "../types/databaseConnection.types";

let pending: Promise<ConnectionInfo> | undefined;

/** Reuse a browser session, or connect to the server-configured default database. */
export function loadDefaultConnection(): Promise<ConnectionInfo> {
  // Share in-flight work across mounts, including React Strict Mode's effect replay.
  if (pending) return pending;
  pending = (async () => {
    const existing = await fetch("/api/database/connection");
    const session = await existing.json();
    if (existing.ok && session.connected) return session as ConnectionInfo;
    if (!existing.ok && existing.status !== 400) {
      throw new Error(
        session.error || "Could not load the database connection.",
      );
    }

    const response = await fetch("/api/database/connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: false }),
    });

    const connection = await response.json();

    if (!response.ok || !connection.connected) {
      throw new Error(
        connection.error || "Could not connect to the default database.",
      );
    }

    return connection as ConnectionInfo;
  })().finally(() => {
    pending = undefined;
  });
  return pending;
}
