import { on } from "events";
import { useState } from "react";

export type QueryBoxProps = {
    onQueryExecute: (query: string) => void;
}

/**
 * A component that can be used to enter SQL queries.
 * @returns JSX.Element
 */
export const QueryBox = ({ onQueryExecute }: QueryBoxProps) => {
    const[query, setQuery] = useState<string>("");

    const onQueryChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setQuery(event.target.value);
    }

    const onExecuteClicked = () => {
        if(!query.trim()) {
            alert("Please enter a query.");
            return;
        }
        // Placeholder for execute button logic
        console.log(query.split('\n'));
        onQueryExecute(query);
    }
    
    return (
        <div className="query-box w-full mb-4 font-mono">
            <textarea
                onChange={onQueryChange}
                className="query-input w-full min-h-75 p-5 border border-gray-300 rounded- mdfocus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your SQL query here..."
            />
            <button onClick={onExecuteClicked} className="execute-button mt-10 p-5 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                Execute
            </button>
        </div>
    );
}