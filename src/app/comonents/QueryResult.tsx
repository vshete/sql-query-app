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

export const QueryResult = ({ data, errorMessage, isDataLoading }: QueryReultProps) => {
    if (isDataLoading) {
        return (
            <div className="query-result flex justify-center items-center mt-10">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                <span className="ml-4 text-gray-500">Loading...</span>
            </div>
        );
    }

    if (data === undefined) {
        return <div className="query-result text-gray-500 mt-10">Your query results will appear here.</div>;
    }

    if (data.length === 0) {
        return <div className="query-result text-center text-gray-500">No results found.</div>;
    }

    if (errorMessage) {
        return <div className="query-result text-red-500">{errorMessage}</div>;
    }

    const columns: string[] = data[0];

    return (
        <div className="query-result w-full overflow-auto w-full max-h-50 scroll-smooth">
            <table className="table-auto w-full border-collapse border border-gray-300">
                <thead>
                    <tr className="bg-gray-200">
                        {columns.map((col: string) => (
                            <th
                                key={col}
                                className="border border-gray-300 py-5 px-3 text-left whitespace-nowrap min-w-[150px]"
                            >
                                {col}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row: string[], rowIndex: number) => {
                        if (rowIndex === 0) return null; // Skip header row
                        return (
                            <tr
                                key={rowIndex}
                                className={rowIndex % 2 === 0 ? "bg-white" : "bg-gray-100"}
                            >
                                {row.map((cell: string, colIndex) => (
                                    <td
                                        key={`${rowIndex}-${colIndex}`}
                                        className="border border-gray-300 whitespace-nowrap min-w-[150px] p-3"
                                    >
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};