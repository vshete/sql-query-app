"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import type {
  DatabaseQueryResult,
  QueryRow,
  QueryValue,
} from "../types/query.types";
import {
  compareQueryValues,
  formatQueryValue,
  RESULTS_PAGE_SIZE,
  MIN_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
} from "../services/queryResults";

export function createResultColumns(names: string[]): ColumnDef<QueryRow>[] {
  return names.map((column, index) => ({
    // An accessor function treats dots/brackets in SQL aliases literally.
    id: String(index),
    accessorFn: (row) => row[column],
    header: column,
    cell: (info) => formatQueryValue(info.getValue() as QueryValue),
    sortingFn: (left, right, id) =>
      compareQueryValues(left.getValue(id), right.getValue(id)),
    sortDescFirst: false,
    minSize: MIN_COLUMN_WIDTH,
    maxSize: MAX_COLUMN_WIDTH,
  }));
}

export function useQueryResultTable(result: DatabaseQueryResult) {
  const columns = useMemo(
    () => createResultColumns(result.columns),
    [result.columns],
  );
  const tableData = result.rows;
  const [sorting, setSorting] = useState<SortingState>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageCount = Math.max(
    1,
    Math.ceil(tableData.length / RESULTS_PAGE_SIZE),
  );
  const page = Math.max(1, Math.min(currentPage, pageCount));
  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      pagination: { pageIndex: page - 1, pageSize: RESULTS_PAGE_SIZE },
    },
    onSortingChange: (update) => {
      setSorting(update);
      setCurrentPage(1);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableColumnResizing: true,
    columnResizeMode: "onChange",
  });
  useEffect(() => {
    setCurrentPage(1);
    setSorting([]);
    table.resetColumnSizing();
  }, [result, table]);
  const columnSizeVars: Record<string, number> = {};
  for (const header of table.getFlatHeaders()) {
    columnSizeVars[`--header-${header.id}-size`] = header.getSize();
    columnSizeVars[`--col-${header.column.id}-size`] = header.column.getSize();
  }
  return { table, columnSizeVars, page, pageCount, setCurrentPage };
}
