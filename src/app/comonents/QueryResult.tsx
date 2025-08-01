

export type QueryReultProps = {
    /* A tow dimensional array representing the table */
    data: Array<Array<string>>;
}

/**
 * A react component that renders the query results in a tabular format
 * * @param {Object} props - The properties passed to the component
 * * @param {Array} props.data - The data to be displayed in the table
 * * @returns {JSX.Element} - The rendered component
 */

export const QueryResult = ({ data }: QueryReultProps) => {
    if (!data || data.length === 0) {
        return <div className="query-result">No results found.</div>;
    }

    const columns: string[] = data[0];

    return (
        <div className="query-result">
            <table>
                <thead>
                    <tr>
                        {columns.map((col: string) => (
                            <th key={col}>{col}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row: string[], rowIndex: number) => {
                        if (rowIndex === 0) return <></>
                        return (<tr key={rowIndex}>
                            {
                                row.map((cell: string, colIndex) => (
                                    <td key={`${rowIndex}-${colIndex}`}>{cell}</td>
                                ))
                            }
                        </tr>)
                    })}
                </tbody>
            </table>
        </div>
    );
}