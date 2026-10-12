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
  const [attempt, setAttempt] = useState(0);
  const retryConnection = useCallback(() => {
    setIsConnecting(true);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setConnectionError("");
    loadDefaultConnection()
      .then((value) => {
        if (!cancelled) setConnection(value);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setConnectionError(
            error instanceof Error
              ? error.message
              : "Could not connect to the default database.",
          );
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
