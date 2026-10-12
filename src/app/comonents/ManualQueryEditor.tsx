"use client";

import { useState } from "react";
import type { DatabaseQueryResult } from "../types/query.types";
import styles from "./AIQueryBuilder/queryAgent.module.css";
import { QueryBox } from "./QueryBox";
import { WorkspaceIcon } from "./WorkspaceIcon";

/** Preserved for future manual SQL workflows; not mounted in the query workspace. */
export function ManualQueryEditor({
  onResult,
  disabled,
}: {
  onResult: (result: DatabaseQueryResult) => void;
  disabled?: boolean;
}) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState("");

  async function execute(query: string) {
    if (disabled || isExecuting) return;
    setIsExecuting(true);
    setError("");
    try {
      const response = await fetch("/api/post/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Query execution failed.");
      onResult(result);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Query execution failed.",
      );
    } finally {
      setIsExecuting(false);
    }
  }

  return (
    <details className={styles.mockResults}>
      <summary className={styles.editorSummary}>
        <WorkspaceIcon name="terminal" /> Manual SQL editor{" "}
        <span>Write and run your own query</span>
      </summary>
      <QueryBox
        onQueryExecute={(query) => void execute(query)}
        isDisabled={disabled || isExecuting}
      />
      {isExecuting && <p role="status">Running query…</p>}
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
    </details>
  );
}
