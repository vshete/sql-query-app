"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson } from "../lib/client/clientApi";
import { parseQueryResult } from "../lib/client/clientValidation";
import type { DatabaseQueryResult } from "../types/query.types";

/** Shared manual execution lifecycle; the table owns display pagination. */
export function useFetchQueryResults() {
  const [result, setResult] = useState<DatabaseQueryResult>();
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const active = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      const controller = active.current;
      active.current = null;
      controller?.abort();
    },
    [],
  );

  const executeQuery = useCallback(async (query: string) => {
    if (active.current || !query.trim()) return;
    const controller = new AbortController();
    active.current = controller;
    setIsDataLoading(true);
    setErrorMessage(undefined);
    setResult(undefined);
    try {
      const response = await fetchJson("/api/post/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(30_000),
        ]),
      });
      const value = parseQueryResult(response);
      if (active.current === controller) {
        setResult(value);
        return value;
      }
    } catch (error: unknown) {
      if (active.current === controller)
        setErrorMessage(
          error instanceof Error ? error.message : "Query execution failed.",
        );
    } finally {
      if (active.current === controller) {
        active.current = null;
        setIsDataLoading(false);
      }
    }
  }, []);

  return { result, isDataLoading, errorMessage, executeQuery };
}
