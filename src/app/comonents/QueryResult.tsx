import React, { useEffect, useMemo } from "react";
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    ColumnDef,
    SortingState,
    flexRender,
} from "@tanstack/react-table";
import { TableRow } from "./TableRow";

type QueryResultProps = {
    /* A two-dimensional array representing the table */
    data?: string[][];
    errorMessage?: string;
    initialPage?: number;
    isDataLoading?: boolean;
    onDownload?: () => void;
    totalPages?: number;
    onPageChange?: (page: number) => void;
}

/**
 * A react component that renders the query results in a tabular format
 * @param {Object} props - The properties passed to the component
 * @param {Array} props.data - The data to be displayed in the table
 * @returns {JSX.Element} - The rendered component
 */
export const QueryResult = React.memo(({
    data,
    errorMessage,
    isDataLoading,
    initialPage,
    onDownload,
    totalPages,
    onPageChange
}: QueryResultProps) => {

    const columns: ColumnDef<string[]>[] = useMemo(() => data?.[0]?.map((col, colIndex) => ({
        accessorKey: colIndex.toString(),
        header: col,
        cell: (info) => info.getValue(),
        sortUndefined: 'last'
    })), [data]) || [];

    const tableData = useMemo(() => data?.slice(1), [data]) || [];

    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [currentPage, setCurrentPage] = React.useState(1);

    const table = useReactTable({
        data: tableData,
        columns,
        state: {
            sorting,
            pagination: {
                pageIndex: currentPage - 1, // Start at the first page
                pageSize: 10, // Set a default page size
            },
        },
        onSortingChange: setSorting, // Ideally sorting should be on entire data but since we have paginated data, only the data fetched so far will be sorted
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(), // Enable pagination
        enableColumnResizing: true,
        columnResizeMode: "onChange",
    });

    useEffect(() => {
        if (initialPage) {
            setCurrentPage(initialPage);
        }
    }, [initialPage]);

    const goToPreviousPage = () => {
        if (currentPage > 1) {
            onPageChange?.(currentPage - 1);
            setCurrentPage(currentPage - 1);
        }
    }
    
    const goToNextPage = () => {
        if (totalPages && currentPage < totalPages) {
            onPageChange?.(currentPage + 1);
            setCurrentPage(currentPage + 1);
        }
    }

    const { columnSizing } = table.getState();
    const columnSizeVars = React.useMemo(() => {
        const colSizes: Record<string, number> = {};
        for (const header of table.getFlatHeaders()) {
            colSizes[`--header-${header.id}-size`] = header.getSize();
            colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
        }
        return colSizes;
        // TanStack keeps the table instance stable; sizing state invalidates cached widths.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [table, columnSizing]);

    if (errorMessage) {
        return <div className="query-result text-red-500">{errorMessage}</div>;
    }

    if (!data && isDataLoading) {
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

    return (
        <div>
            <div>
                <button onClick={onDownload} className="bg-blue-500 text-white p-2 rounded mb-4 cursor-pointer">
                    Download Results
                </button>
            </div>
            <div className="query-result w-full overflow-x-auto scroll-smooth">
                <table className="table-fixed w-full border-collapse border border-gray-300" style={{ ...columnSizeVars }}>
                    <thead>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id} className="bg-gray-200">
                                {headerGroup.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className="border border-gray-300 py-5 px-3 text-left whitespace-nowrap group relative overflow-hidden"
                                        style={{
                                            width: columnSizeVars[`--header-${header.id}-size`] ? `calc(var(--header-${header?.id}-size) * 1px)` : 'auto',
                                        }}
                                    >

                                        {/* The data will be fetched in the order specified in the query by the user */}
                                        {/* If the data is really to be sorted based on column, first the entire dataset should be fetched. Make that modification on this click */}
                                        <span onClick={header.column.getToggleSortingHandler()} className="cursor-pointer">
                                            {
                                                header.column.getCanSort()
                                                    ? header.column.getNextSortingOrder() === 'asc'
                                                        ? '⥮'
                                                        : header.column.getNextSortingOrder() === 'desc'
                                                            ? '⇑'
                                                            : '⇓'
                                                    : undefined
                                            }
                                        </span>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                        <div
                                            {...{
                                                onDoubleClick: () => header.column.resetSize(),
                                                onMouseDown: header.getResizeHandler(),
                                                onTouchStart: header.getResizeHandler(),
                                                className: `resizer absolute top-0 h-full right-0 w-[5px] cursor-col-resize select-none touch-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${header.column.getIsResizing() ? 'bg-blue-500 opacity-100' : 'bg-black bg-opacity-50'}`,
                                            }}
                                        />
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {table.getRowModel().rows.map((row) => (
                            <TableRow key={row.id} columnSizeVars={columnSizeVars} row={row} />
                        ))}
                    </tbody>
                </table>
            </div>
            {/* Pagination Controls */}
            <div className="pagination-controls mt-4">
                <button
                    className={`${currentPage === 1 ? 'cursor-text' : 'cursor-pointer'} cursor-pointer px-4 py-2 mr-5 bg-blue-200 rounded disabled:opacity-50`}
                    onClick={() => goToPreviousPage()}
                    disabled={currentPage === 1}
                >
                    Previous
                </button>
                <span className="mr-5">
                    Page{" "}
                    <strong>
                        {table.getState().pagination.pageIndex + 1} of{" "}
                        {totalPages}
                    </strong>
                </span>
                <button
                    className={`${!!totalPages && currentPage >= totalPages ? 'cursor-text' : 'cursor-pointer'} px-4 py-2 bg-blue-200 rounded disabled:opacity-50`}
                    onClick={() => goToNextPage()}
                    disabled={!!totalPages && currentPage >= totalPages}
                >
                    Next
                </button>
            </div>
        </div>
    );
});

QueryResult.displayName = "QueryResult";