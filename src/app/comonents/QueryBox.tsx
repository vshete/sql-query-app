import { useEffect, useState } from "react";

export type QueryBoxProps = {
    onQueryExecute: (query: string) => void;
    handleSave: (query: string) => void;
    isDisabled?: boolean;
    initialQuery?: string;
}

/**
 * A component that can be used to enter SQL queries.
 * @returns JSX.Element
 */
export const QueryBox = ({ onQueryExecute, handleSave, isDisabled, initialQuery = "" }: QueryBoxProps) => {
    const [query, setQuery] = useState(initialQuery);

    useEffect(() => {
        setQuery(initialQuery);
    }, [initialQuery]);

    const handleExecute = () => {
        onQueryExecute(query);
    };

    const handleSaveInner = () => {
        if (query.trim() === "") {
            alert("Query cannot be empty.");
            return;
        }
        handleSave(query);
    }

    return (
        <div className="query-box w-full mb-4 font-mono">
            <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isDisabled}
                className="query-input w-full min-h-50 p-5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your SQL query here..."
            />
            <button
                onClick={handleExecute}
                disabled={isDisabled}
                className={`execute-button mt-3 p-2 cursor-pointer rounded-md ${
                    isDisabled
                        ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                        : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
            >
                Execute
            </button>
            <button
                onClick={handleSaveInner}
                disabled={isDisabled}
                className={`execute-button mt-3 ml-3 p-2 cursor-pointer rounded-md ${
                    isDisabled
                        ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                        : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
            >
                Save Query
            </button>
        </div>
    );
};