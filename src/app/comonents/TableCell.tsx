import styles from "./AIQueryBuilder/queryAgent.module.css";
import { Cell, flexRender } from "@tanstack/react-table";
import React from "react";

type TableCellProps = {
  cell: Cell<string[], unknown>;
  columnSizeVars: { [key: string]: number };
};

export const TableCell = React.memo(
  ({ cell, columnSizeVars }: TableCellProps) => {
    return (
      <td
        key={cell.id}
        className={styles.resultCell}
        title={String(cell.getValue() ?? "")}
        style={{
          width: columnSizeVars[`--col-${cell.column.id}-size`]
            ? `calc(var(--col-${cell.column.id}-size) * 1px)`
            : "auto",
        }}
      >
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </td>
    );
  },
);

TableCell.displayName = "TableCell";
