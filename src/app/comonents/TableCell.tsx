import { Cell, flexRender } from "@tanstack/react-table"
import React from "react";

export type TableCellProps = {
    cell: Cell<string[], unknown>,
    columnSizeVars: { [key: string]: number }
}

export const TableCell = React.memo(({ cell, columnSizeVars }: TableCellProps) => {
    return (
        <td
            key={cell.id}
            className="border border-gray-300 whitespace-nowrap p-3 overflow-hidden text-ellipsis"
            style={{
                width: columnSizeVars[`--col-${cell.column.id}-size`] ? `calc(var(--col-${cell.column.id}-size) * 1px)` : 'auto',
            }}
        >
            {flexRender(
                cell.column.columnDef.cell,
                cell.getContext()
            )}
        </td>
    )
});

TableCell.displayName = "TableCell";