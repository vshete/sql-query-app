import { memo } from "react";
import { flexRender, type Cell } from "@tanstack/react-table";
import type { QueryRow, QueryValue } from "../types/query.types";
import { formatQueryValue } from "../services/queryResults";
import styles from "./AIQueryBuilder/queryAgent.module.css";

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
