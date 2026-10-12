import React, { useEffect, useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
  flexRender,
} from "@tanstack/react-table";
import { TableRow } from "./TableRow";
import { WorkspaceIcon } from "./WorkspaceIcon";
import styles from "./AIQueryBuilder/queryAgent.module.css";

type QueryResultProps = {
  data?: string[][];
  errorMessage?: string;
  message?: string;
  initialPage?: number;
  isDataLoading?: boolean;
  onDownload?: () => void;
  totalPages?: number;
  onPageChange?: (page: number) => void;
};

export const QueryResult = React.memo(function QueryResult({
  data,
  errorMessage,
  message,
  isDataLoading,
  initialPage = 1,
  onDownload,
  totalPages,
  onPageChange,
}: QueryResultProps) {
  const columns = useMemo<ColumnDef<string[]>[]>(
    () =>
      data?.[0]?.map((col, index) => ({
        accessorKey: index.toString(),
        header: col,
        cell: (info) => info.getValue(),
        sortUndefined: "last",
      })) ?? [],
    [data],
  );
  const tableData = useMemo(() => data?.slice(1) ?? [], [data]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const pageCount = Math.max(1, totalPages ?? Math.ceil(tableData.length / 10));
  const page = Math.min(currentPage, pageCount);
  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting, pagination: { pageIndex: page - 1, pageSize: 10 } },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: !!onPageChange,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
  });
  useEffect(() => {
    setCurrentPage(initialPage);
  }, [initialPage, data]);
  const changePage = (nextPage: number) => {
    setCurrentPage(nextPage);
    onPageChange?.(nextPage);
  };
  const { columnSizing } = table.getState();
  const columnSizeVars = useMemo(() => {
    const sizes: Record<string, number> = {};
    for (const header of table.getFlatHeaders()) {
      sizes[`--header-${header.id}-size`] = header.getSize();
      sizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return sizes;
    // The table instance is stable; sizing and columns invalidate these widths.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, columnSizing, columns]);
  const rowCount = tableData.length;
  const hasRows = rowCount > 0;
  const visibleRows = table.getRowModel().rows;

  return (
    <div className={styles.resultsPanel} aria-busy={isDataLoading || false}>
      <div className={styles.resultsToolbar}>
        <div className={styles.resultsTitle}>
          <WorkspaceIcon name={data && !errorMessage ? "check" : "table"} />
          <span>Query results</span>
          {data && !errorMessage && (
            <span className={styles.rowCount}>
              {rowCount.toLocaleString()} rows loaded
            </span>
          )}
        </div>
        {onDownload && data && !errorMessage && (
          <button
            className={styles.downloadBtn}
            onClick={onDownload}
            disabled={isDataLoading}
          >
            <WorkspaceIcon name="download" size={14} /> Download CSV
          </button>
        )}
      </div>
      {message && !errorMessage && (
        <p className={styles.resultsMessage}>{message}</p>
      )}
      {errorMessage ? (
        <div className={styles.error} role="alert">
          {errorMessage}
        </div>
      ) : isDataLoading && !data ? (
        <div className={styles.emptyResults} role="status">
          <span className={styles.generationSpinner} />
          <strong>Running your query…</strong>
          <p>Results will appear here when execution finishes.</p>
        </div>
      ) : !hasRows ? (
        <div className={styles.emptyResults}>
          <WorkspaceIcon name="table" size={26} />
          <strong>
            {data ? "No rows returned" : "Ready for your first query"}
          </strong>
          <p>
            {data
              ? "Your query completed without returning rows."
              : "Generate a query to explore your data."}
          </p>
        </div>
      ) : (
        <>
          <div className={styles.tableScroll}>
            <table
              className={styles.resultTable}
              aria-label="Query results"
              style={{ ...columnSizeVars, minWidth: table.getTotalSize() }}
            >
              <thead>
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => (
                      <th
                        key={header.id}
                        scope="col"
                        aria-sort={
                          header.column.getIsSorted() === "asc"
                            ? "ascending"
                            : header.column.getIsSorted() === "desc"
                              ? "descending"
                              : "none"
                        }
                        style={{
                          width: `calc(var(--header-${header.id}-size) * 1px)`,
                        }}
                      >
                        {header.isPlaceholder ? null : (
                          <button
                            className={styles.sortButton}
                            onClick={header.column.getToggleSortingHandler()}
                            disabled={!header.column.getCanSort()}
                            title={`Sort ${String(header.column.columnDef.header)} (loaded rows)`}
                          >
                            <span>
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                            </span>
                            <span aria-hidden="true">
                              {header.column.getIsSorted() === "asc"
                                ? "↑"
                                : header.column.getIsSorted() === "desc"
                                  ? "↓"
                                  : "↕"}
                            </span>
                          </button>
                        )}
                        <div
                          onDoubleClick={() => header.column.resetSize()}
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`${styles.resizer} ${header.column.getIsResizing() ? styles.resizing : ""}`}
                          aria-hidden="true"
                        />
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <TableRow
                    key={row.id}
                    columnSizeVars={columnSizeVars}
                    row={row}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.resultsFooter}>
            <span>
              Showing {(page - 1) * 10 + 1}–
              {(page - 1) * 10 + visibleRows.length}
              {!onPageChange && ` of ${rowCount}`} rows
            </span>
            <nav className={styles.pagination} aria-label="Results pagination">
              <span aria-live="polite">
                Page {page} of {pageCount}
              </span>
              <button
                className={styles.pageBtn}
                onClick={() => changePage(page - 1)}
                disabled={page <= 1 || isDataLoading}
              >
                Previous
              </button>
              <button
                className={styles.pageBtn}
                onClick={() => changePage(page + 1)}
                disabled={page >= pageCount || isDataLoading}
              >
                Next
              </button>
            </nav>
          </div>
        </>
      )}
    </div>
  );
});
