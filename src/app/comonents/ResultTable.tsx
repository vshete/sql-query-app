"use client";

import { flexRender, type Header, type Table } from "@tanstack/react-table";
import type { DatabaseQueryResult, QueryRow } from "../types/query.types";
import {
  RESULTS_PAGE_SIZE,
  MIN_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
  COLUMN_RESIZE_STEP,
} from "../services/queryResults";
import { useQueryResultTable } from "../hooks/useQueryResultTable";
import { TableRow } from "./TableRow";
import styles from "./AIQueryBuilder/queryAgent.module.css";

function ResultHeader({
  header,
  table,
}: {
  header: Header<QueryRow, unknown>;
  table: Table<QueryRow>;
}) {
  return (
    <th
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
          type="button"
          className={styles.sortButton}
          onClick={header.column.getToggleSortingHandler()}
          disabled={!header.column.getCanSort()}
          title={`Sort ${String(header.column.columnDef.header)} (loaded rows)`}
        >
          <span>
            {flexRender(header.column.columnDef.header, header.getContext())}
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
        role="separator"
        tabIndex={0}
        aria-label={`Resize ${String(header.column.columnDef.header)}`}
        aria-orientation="vertical"
        aria-valuemin={header.column.columnDef.minSize}
        aria-valuemax={header.column.columnDef.maxSize}
        aria-valuenow={header.column.getSize()}
        onKeyDown={(event) => {
          if (
            event.key !== "ArrowLeft" &&
            event.key !== "ArrowRight" &&
            event.key !== "Home"
          )
            return;
          event.preventDefault();
          if (event.key === "Home") {
            header.column.resetSize();
            return;
          }
          const step = event.shiftKey ? 1 : COLUMN_RESIZE_STEP;
          const size =
            header.column.getSize() +
            (event.key === "ArrowLeft" ? -step : step);
          table.setColumnSizing((previous) => ({
            ...previous,
            [header.column.id]: Math.max(
              MIN_COLUMN_WIDTH,
              Math.min(MAX_COLUMN_WIDTH, size),
            ),
          }));
        }}
      />
    </th>
  );
}

export function ResultTable({
  result,
  isDataLoading,
}: {
  result: DatabaseQueryResult;
  isDataLoading?: boolean;
}) {
  const { table, columnSizeVars, page, pageCount, setCurrentPage } =
    useQueryResultTable(result);
  const visibleRows = table.getRowModel().rows;
  const rowCount = result.rows.length;
  return (
    <>
      <div
        className={styles.tableScroll}
        tabIndex={0}
        role="region"
        aria-label="Scrollable query results"
      >
        <table
          className={styles.resultTable}
          aria-label="Query results"
          style={{ ...columnSizeVars, minWidth: table.getTotalSize() }}
        >
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <ResultHeader key={header.id} header={header} table={table} />
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <TableRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.resultsFooter}>
        <span>
          Showing {(page - 1) * RESULTS_PAGE_SIZE + 1}–
          {(page - 1) * RESULTS_PAGE_SIZE + visibleRows.length}
          {` of ${rowCount}`} rows
        </span>
        <nav className={styles.pagination} aria-label="Results pagination">
          <span aria-live="polite">
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => setCurrentPage(page - 1)}
            disabled={page <= 1 || isDataLoading}
          >
            Previous
          </button>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => setCurrentPage(page + 1)}
            disabled={page >= pageCount || isDataLoading}
          >
            Next
          </button>
        </nav>
      </div>
    </>
  );
}
