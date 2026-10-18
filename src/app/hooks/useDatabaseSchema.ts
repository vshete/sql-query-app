"use client";

import { useCallback, useEffect, useState } from "react";
import { loadDatabaseSchema } from "../services/clientSchema";
import type { SchemaTable } from "../types/databaseSchema.types";

/** Load shared browser metadata and suppress updates after cleanup without cancelling other subscribers. */
export function useDatabaseSchema() {
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState({ id: 0, refresh: false });
  const refreshSchema = useCallback(() => {
    if (isLoading) return;
    setIsLoading(true);
    setAttempt((value) => ({ id: value.id + 1, refresh: true }));
  }, [isLoading]);

  useEffect(() => {
    let cancelled = false;
    loadDatabaseSchema(attempt.refresh)
      .then((value) => {
        if (!cancelled) {
          setTables(value.tables);
          setError("");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setError(
            error instanceof Error ? error.message : "Could not load schema.",
          );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { tables, isLoading, error, refreshSchema };
}
