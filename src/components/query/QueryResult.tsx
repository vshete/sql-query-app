"use client";

import { memo } from "react";
import { useFileDownload } from "../../hooks/useFileDownload";
import type { DatabaseQueryResult } from "../../types/query.types";
import styles from "./queryAgent.module.css";
import { ResultTable } from "./ResultTable";
import { WorkspaceIcon } from "./WorkspaceIcon";

interface QueryResultProps {
  result?: DatabaseQueryResult;
  errorMessage?: string;
  isDataLoading?: boolean;
}

/** Present result status, snapshot export, and the table without owning query execution. */
export const QueryResult = memo(function QueryResult({
  result,
  errorMessage,
  isDataLoading,
}: QueryResultProps) {
  const { onDownload, downloadError } = useFileDownload(result);
  const rowCount = result?.rows.length ?? 0;

  if (!result && !errorMessage) return null;

  return (
    <div className={styles.resultsPanel} aria-busy={isDataLoading || false}>
      <div className={styles.resultsToolbar}>
        <div className={styles.resultsTitle}>
          <WorkspaceIcon name={result && !errorMessage ? "check" : "table"} />
          <span>Query results</span>
          {result && !errorMessage && (
            <span className={styles.rowCount}>
              {rowCount.toLocaleString()} rows loaded
            </span>
          )}
        </div>
        {result && !errorMessage && (
          <button
            type="button"
            className={styles.downloadBtn}
            onClick={() => onDownload(result)}
            disabled={isDataLoading}
          >
            <WorkspaceIcon name="download" size={14} /> Download CSV
          </button>
        )}
      </div>
      {downloadError && (
        <div className={styles.error} role="alert">
          {downloadError}
        </div>
      )}
      {result && !errorMessage && (
        <p className={styles.resultsMessage}>{result.message}</p>
      )}
      {errorMessage ? (
        <div className={styles.error} role="alert">
          {errorMessage}
        </div>
      ) : !result || rowCount === 0 ? (
        <div className={styles.emptyResults}>
          <WorkspaceIcon name="table" size={26} />
          <strong>No rows returned</strong>
          <p>Your query completed without returning rows.</p>
        </div>
      ) : (
        <ResultTable result={result} isDataLoading={isDataLoading} />
      )}
    </div>
  );
});
