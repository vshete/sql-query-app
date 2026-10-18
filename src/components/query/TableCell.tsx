import { memo } from "react";
import { flexRender, type Cell } from "@tanstack/react-table";
import type { QueryRow, QueryValue } from "../../types/query.types";
import { formatQueryValue } from "../../lib/shared/queryResults";
import styles from "./queryAgent.module.css";

/** Render one typed value; inherit column widths through CSS variables during resizing. */
export const TableCell = memo(function TableCell({
  cell,
}: {
  cell: Cell<QueryRow, unknown>;
}) {
  return (
    <td
      className={styles.resultCell}
      title={formatQueryValue(cell.getValue() as QueryValue)}
      style={{ width: `calc(var(--col-${cell.column.id}-size) * 1px)` }}
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </td>
  );
});
