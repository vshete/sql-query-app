'use client'
import { QueryBox } from "./QueryBox";
import { QueryResult } from "./QueryResult";
import { useFetchQueryResults } from "../hooks/useFetchQueryResults";
import { useState } from "react";
import { QuerySidebar } from "./QuerySidebar";
import { useFetchPredefinedQueries } from "../hooks/useFetchPredefinedQueries";
import { useFileDownload } from "../hooks/useFileDownload";

/**
 * Root component of the application.
 */
export const AppEntry = () => {
    const { data, isDataLoading, errorMessage, executeQuery } = useFetchQueryResults();
    const { queries: predefinedQueries, isLoading: isQueriesLoading, error: queriesError } = useFetchPredefinedQueries(); // Use the new hook
    const [selectedQuery, setSelectedQuery] = useState<string>("");
    const {onDownload }= useFileDownload(data);

    const handleQuerySelect = (query: string) => {
        setSelectedQuery(query);
    };

    const handleSave = (query: string) => {
        console.log(query);
        alert("Your query has been saved! [DEMO MESSAGE]");
    }

    return (
        <div className="flex">
            <QuerySidebar 
                queries={predefinedQueries} 
                onQuerySelect={(queryObj) => handleQuerySelect(queryObj.query)} 
            />
            <main className="w-3/4 flex-1 p-5 font-mono">
                {isQueriesLoading && <p>Loading predefined queries...</p>}
                {queriesError && <p className="text-red-500">Error: {queriesError}</p>}
                <QueryBox
                    onQueryExecute={executeQuery}
                    isDisabled={isDataLoading}
                    initialQuery={selectedQuery}
                    handleSave={handleSave}
                />
                <QueryResult
                    data={data}
                    errorMessage={errorMessage}
                    isDataLoading={isDataLoading}
                    onDownload={onDownload}
                />
            </main>
        </div>
    );
};