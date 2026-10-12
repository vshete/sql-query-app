"use client";
import { useCallback, useRef, useState } from "react";
import type { DatabaseQueryResult } from "../types/query.types";

export const useFetchQueryResults = () => {
  const [data, setData] = useState<string[][]>();
  const [totalPages, setTotalPages] = useState(0);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const loading = useRef(false);
  const executeQuery = useCallback(async (query: string) => {
    if (loading.current) return;
    loading.current = true;
    setIsDataLoading(true);
    setErrorMessage(undefined);
    setData(undefined);
    setTotalPages(0);
    try {
      const response = await fetch("/api/post/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Failed to execute query");
      const rows = result as DatabaseQueryResult;
      setData([
        rows.columns,
        ...rows.rows.map((row) =>
          rows.columns.map((column) => String(row[column] ?? "")),
        ),
      ]);
      setTotalPages(Math.max(1, Math.ceil(rows.rowCount / 10)));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to execute query.",
      );
    } finally {
      loading.current = false;
      setIsDataLoading(false);
    }
  }, []);
  return { data, isDataLoading, errorMessage, executeQuery, totalPages };
};
