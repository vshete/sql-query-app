import React from "react"
import { TableCell } from "./TableCell"
import { Cell, Row } from "@tanstack/react-table"

export type TableRowProps = {
    row: Row<string[]>,
    columnSizeVars: { [key: string]: number }
}

export const TableRow = React.memo(({ row, columnSizeVars }: TableRowProps) => {
    return (
        <tr
            key={row.id}
            className={row.index % 2 === 0 ? "bg-white" : "bg-gray-100"}
        >
            {row.getVisibleCells().map((cell: Cell<string[], unknown>) => (
                <TableCell
                    key={cell.id}
                    columnSizeVars={columnSizeVars}
                    cell={cell}
                />
            ))}
        </tr>
    )
})

TableRow.displayName = "TableRow";