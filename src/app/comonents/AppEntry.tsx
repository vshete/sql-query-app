'use client'
import { QueryBox } from "./QueryBox";
import { QueryResult } from "./QueryResult";
import { useFetchQueryResults } from "../hooks/useFetchQueryResults";
import { useState } from "react";
import { QuerySidebar } from "./QuerySidebar";
import { useFetchPredefinedQueries } from "../hooks/useFetchPredefinedQueries";

/**
 * Root component of the application.
 */
export const AppEntry = () => {
    const { data, isDataLoading, errorMessage, executeQuery } = useFetchQueryResults();
    const { queries: predefinedQueries, isLoading: isQueriesLoading, error: queriesError } = useFetchPredefinedQueries(); // Use the new hook
    const [selectedQuery, setSelectedQuery] = useState<string>("");

    const handleQuerySelect = (query: string) => {
        setSelectedQuery(query);
    };

    return (
        <div className="flex">
            <QuerySidebar 
                queries={predefinedQueries} 
                onQuerySelect={(queryObj) => handleQuerySelect(queryObj.query)} 
            />
            <main className="flex-1 w-full p-5 font-mono">
                {isQueriesLoading && <p>Loading predefined queries...</p>}
                {queriesError && <p className="text-red-500">Error: {queriesError}</p>}
                <QueryBox
                    onQueryExecute={executeQuery}
                    isDisabled={isDataLoading}
                    initialQuery={selectedQuery}
                />
                <QueryResult
                    data={data}
                    errorMessage={errorMessage}
                    isDataLoading={isDataLoading}
                />
            </main>
        </div>
    );
};