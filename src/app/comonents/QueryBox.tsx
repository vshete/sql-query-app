import { useState } from "react";

export type QueryBoxProps = {
    onQueryExecute: (query: string) => void;
    isDisabled?: boolean
}

/**
 * A component that can be used to enter SQL queries.
 * @returns JSX.Element
 */
export const QueryBox = ({ onQueryExecute, isDisabled }: QueryBoxProps) => {
    const[query, setQuery] = useState<string>("");

    const onQueryChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setQuery(event.target.value);
    }

    const onExecuteClicked = () => {
        if(!query.trim()) {
            alert("Please enter a query.");
            return;
        }
        onQueryExecute(query);
    }
    
    return (
        <div className="query-box w-full mb-4 font-mono">
            <textarea
                disabled={isDisabled}
                onChange={onQueryChange}
                className={`query-input w-full min-h-75 p-5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDisabled ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : ''}`}
                placeholder="Enter your SQL query here..."
            />
            <button
                disabled={isDisabled}
                onClick={onExecuteClicked}
                className={`execute-button mt-10 p-3 cursor-pointer rounded-md 
                    ${isDisabled ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
            >
                Execute
            </button>
        </div>
    );
}