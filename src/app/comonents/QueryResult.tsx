import React, { useMemo } from "react";
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    ColumnDef,
    SortingState,
    flexRender,
} from "@tanstack/react-table";

export type QueryReultProps = {
    /* A two-dimensional array representing the table */
    data?: string[][];
    errorMessage?: string;
    isDataLoading?: boolean;
}

/**
 * A react component that renders the query results in a tabular format
 * @param {Object} props - The properties passed to the component
 * @param {Array} props.data - The data to be displayed in the table
 * @returns {JSX.Element} - The rendered component
 */
export const QueryResult = ({
    data,
    errorMessage,
    isDataLoading,
}: QueryReultProps) => {
    if (isDataLoading) {
        return (
            <div className="query-result flex justify-center items-center mt-10">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                <span className="ml-4 text-gray-500">Loading...</span>
            </div>
        );
    }

    if (data === undefined) {
        return (
            <div className="query-result text-gray-500 mt-10">
                Your query results will appear here.
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="query-result text-center text-gray-500">
                No results found.
            </div>
        );
    }

    if (errorMessage) {
        return <div className="query-result text-red-500">{errorMessage}</div>;
    }

    const columns: ColumnDef<string[]>[] = useMemo(() => data[0].map((col, colIndex) => ({
        accessorKey: colIndex.toString(),
        header: col,
        cell: (info) => info.getValue(),
        sortUndefined: 'last'
    })), [data]);

    const tableData = useMemo(() => data.slice(1), [data]);

    const [sorting, setSorting] = React.useState<SortingState>([]);

    const table = useReactTable({
        data: tableData,
        columns,
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(), // Enable pagination
        enableColumnResizing: true,
        columnResizeMode: "onChange",
    });

    return (
        <div>
            <div className="query-result w-full overflow-x-auto scroll-smooth">
                <table className="table-auto border-collapse border border-gray-300">
                    <thead>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id} className="bg-gray-200">
                                {headerGroup.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className="border border-gray-300 py-5 px-3 text-left whitespace-nowrap min-w-[150px] cursor-pointer"
                                        style={{
                                            width: header.getSize(),
                                        }}
                                    >
                                        <div
                                            className={
                                                header.column.getCanSort()
                                                    ? 'cursor-pointer select-none'
                                                    : ''
                                            }
                                            onClick={header.column.getToggleSortingHandler()}
                                            title={
                                                header.column.getCanSort()
                                                    ? header.column.getNextSortingOrder() === 'asc'
                                                        ? 'Sort ascending'
                                                        : header.column.getNextSortingOrder() === 'desc'
                                                            ? 'Sort descending'
                                                            : 'Clear sort'
                                                    : undefined
                                            }
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {table.getRowModel().rows.map((row) => (
                            <tr
                                key={row.id}
                                className={row.index % 2 === 0 ? "bg-white" : "bg-gray-100"}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <td
                                        key={cell.id}
                                        className="border border-gray-300 whitespace-nowrap min-w-[150px] p-3"
                                    >
                                        {flexRender(
                                            cell.column.columnDef.cell,
                                            cell.getContext()
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {/* Pagination Controls */}
            <div className="pagination-controls mt-4">
                <button
                    className={`${table.getCanPreviousPage() ? 'cursor-pointer' : 'cursor-text'} cursor-pointer px-4 py-2 mr-5 bg-blue-200 rounded disabled:opacity-50`}
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                >
                    Previous
                </button>
                <span className="mr-5">
                    Page{" "}
                    <strong>
                        {table.getState().pagination.pageIndex + 1} of{" "}
                        {table.getPageCount()}
                    </strong>
                </span>
                <button
                    className={`${table.getCanNextPage() ? 'cursor-pointer' : 'cursor-text'} px-4 py-2 bg-blue-200 rounded disabled:opacity-50`}
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                >
                    Next
                </button>
            </div>
        </div>
    );
};