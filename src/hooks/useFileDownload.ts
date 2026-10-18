"use client";

import { useCallback, useState } from "react";
import { downloadFile } from "../lib/client/downloadFile";
import { queryResultCsv } from "../lib/shared/queryResults";
import type { DatabaseQueryResult } from "../types/query.types";

/** Download the loaded snapshot, without re-executing SQL against changing data. */
export function useFileDownload(currentResult?: DatabaseQueryResult) {
  const [failure, setFailure] = useState<{
    result: DatabaseQueryResult;
    error: string;
  }>();
  const onDownload = useCallback((result: DatabaseQueryResult) => {
    setFailure(undefined);
    try {
      downloadFile(
        new Blob([queryResultCsv(result)], { type: "text/csv;charset=utf-8" }),
        "query_results.csv",
      );
    } catch (error: unknown) {
      setFailure({
        result,
        error:
          error instanceof Error
            ? error.message
            : "Failed to download results.",
      });
    }
  }, []);
  return {
    onDownload,
    downloadError:
      failure?.result === currentResult ? failure?.error : undefined,
  };
}
