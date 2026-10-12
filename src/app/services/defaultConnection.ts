import type { ConnectionInfo } from "../types/databaseConnection.types";
import { fetchJson, readJsonResponse } from "./clientApi";
import { parseConnectionInfo, responseError } from "./clientValidation";

let pending: Promise<ConnectionInfo> | undefined;
let pendingRefresh = false;

/** Reuse a browser session, or connect to the server-configured default database. */
export function loadDefaultConnection(
  refresh = false,
): Promise<ConnectionInfo> {
  // Share in-flight work across mounts, including React Strict Mode's effect replay.
  if (pending) {
    // A refresh must not silently degrade into an ordinary status read.
    return refresh && !pendingRefresh
      ? pending.then(() => loadDefaultConnection(true))
      : pending;
  }

  pendingRefresh = refresh;
  pending = (async () => {
    const signal = AbortSignal.timeout(30_000);
    const existing = await fetch("/api/database/connection", {
      signal,
      cache: "no-store",
    });

    const session = await readJsonResponse(existing);

    if (existing.ok) {
      const connection = parseConnectionInfo(session);
      if (connection.connected && !refresh) return connection;
      if (connection.connected) {
        return parseConnectionInfo(
          await fetchJson("/api/database/connection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: true }),
            signal,
          }),
        );
      }
    }

    if (!existing.ok && existing.status !== 400) {
      throw new Error(
        responseError(session, "Could not load the database connection."),
      );
    }

    const response = await fetchJson("/api/database/connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: false }),
      signal,
    });

    const connection = parseConnectionInfo(response);

    if (!connection.connected) {
      throw new Error("Could not connect to the default database.");
    }

    return connection;
  })().finally(() => {
    pending = undefined;
    pendingRefresh = false;
  });
  return pending;
}
