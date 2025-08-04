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
    const [currentPage, setCurrrentPage] = useState(1);
    const { data, isDataLoading, errorMessage, executeQuery, totalPages } = useFetchQueryResults(currentPage);
    const { queries: predefinedQueries, isLoading: isQueriesLoading, error: queriesError } = useFetchPredefinedQueries(); // Use the new hook
    const [selectedQuery, setSelectedQuery] = useState<string>("");
    const { onDownload } = useFileDownload(data);


    const handleQuerySelect = (query: string) => {
        setSelectedQuery(query);
    };

    const handleSave = (query: string) => {
        console.log("Saving query:", query);
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
                    totalPages={totalPages}
                    onPageChange={(pageNumber: number) => setTimeout(() => setCurrrentPage(pageNumber), 200)}
                />
            </main>
        </div>
    );
};