"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConnectionInfo } from "../types/databaseConnection.types";
import { loadDefaultConnection } from "../services/defaultConnection";

export function useDefaultDatabaseConnection() {
  const [connection, setConnection] = useState<ConnectionInfo>({
    connected: false,
  });
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState("");
  const [attempt, setAttempt] = useState({ id: 0, refresh: false });
  const retryConnection = useCallback((refresh = false) => {
    setIsConnecting(true);
    setAttempt((value) => ({ id: value.id + 1, refresh }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setConnectionError("");
    loadDefaultConnection(attempt.refresh)
      .then((value) => {
        if (!cancelled) setConnection(value);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setConnection({ connected: false });
          setConnectionError(
            error instanceof Error
              ? error.message
              : "Could not connect to the default database.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsConnecting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { connection, isConnecting, connectionError, retryConnection };
}
