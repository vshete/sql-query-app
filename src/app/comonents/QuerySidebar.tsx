interface QuerySidebarProps {
    queries: { name: string; query: string }[];
    onQuerySelect: (query: { name: string; query: string }) => void;
}

/**
 * A sidebar component that displays a list of predefined queries.
 * @param {Object} props - The properties passed to the component
 * @param {string[]} props.queries - The list of predefined queries to display
 * @param {Function} props.onQuerySelect - Callback function to handle query selection
 * @returns 
 */
export const QuerySidebar = ({ queries, onQuerySelect }: QuerySidebarProps) => {
    return (
        <aside className="w-1/4 h-screen bg-gray-100 p-4 border-r border-gray-300">
            <h2 className="text-lg font-bold mb-4">Predefined Queries</h2>
            <ul className="space-y-2">
                {queries.map((queryObj, index) => (
                    <li key={index}>
                        <button
                            onClick={() => onQuerySelect(queryObj)}
                            className="w-full text-left p-2 bg-blue-100 hover:bg-blue-200 rounded-md cursor-pointer"
                        >
                            {queryObj.name}
                        </button>
                    </li>
                ))}
            </ul>
        </aside>
    );
};