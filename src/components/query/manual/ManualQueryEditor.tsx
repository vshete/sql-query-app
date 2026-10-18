"use client";

import type { DatabaseQueryResult } from "../../../types/query.types";
import { useFetchQueryResults } from "../../../hooks/useFetchQueryResults";
import styles from "../queryAgent.module.css";
import { QueryBox } from "./QueryBox";
import { WorkspaceIcon } from "../WorkspaceIcon";

/** Preserved for future manual SQL workflows; not mounted in the query workspace. */
export function ManualQueryEditor({
  onResult,
  disabled,
}: {
  onResult: (result: DatabaseQueryResult) => void;
  disabled?: boolean;
}) {
  const { executeQuery, isDataLoading, errorMessage } = useFetchQueryResults();

  async function execute(query: string) {
    if (disabled) return;
    const result = await executeQuery(query);
    if (result) onResult(result);
  }

  return (
    <details className={styles.sqlPreview}>
      <summary className={styles.editorSummary}>
        <WorkspaceIcon name="terminal" /> Manual SQL editor{" "}
        <span>Write and run your own query</span>
      </summary>
      <QueryBox
        onQueryExecute={(query) => void execute(query)}
        isDisabled={disabled || isDataLoading}
      />
      {isDataLoading && <p role="status">Running query…</p>}
      {errorMessage && (
        <div className={styles.error} role="alert">
          {errorMessage}
        </div>
      )}
    </details>
  );
}
