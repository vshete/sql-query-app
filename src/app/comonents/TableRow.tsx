import { memo } from "react";
import type { Row } from "@tanstack/react-table";
import type { QueryRow } from "../types/query.types";
import { TableCell } from "./TableCell";
import styles from "./AIQueryBuilder/queryAgent.module.css";

/** Render visible cells while allowing unchanged TanStack rows to skip React renders. */
export const TableRow = memo(function TableRow({
  row,
}: {
  row: Row<QueryRow>;
}) {
  return (
    <tr className={styles.resultRow}>
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id} cell={cell} />
      ))}
    </tr>
  );
});
