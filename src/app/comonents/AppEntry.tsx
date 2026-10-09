'use client'
import { QueryBox } from "./QueryBox";
import { QueryResult } from "./QueryResult";
import { useFetchQueryResults } from "../hooks/useFetchQueryResults";
import { useState } from "react";
import { useFileDownload } from "../hooks/useFileDownload";
import NaturalLanguageInput from "./AIQueryBuilder/NaturalLanguageInput";

/**
 * Root component of the application.
 */
export const AppEntry = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const { data, isDataLoading, errorMessage, executeQuery, totalPages } = useFetchQueryResults(currentPage);
    const [isGeneratingQuery, setIsGeneratingQuery] = useState(false);
    const { onDownload } = useFileDownload();


    const onExecuteQueryWrapper = (query: string) => {
        executeQuery(query, 1);
        setCurrentPage(1);
    }

    return (
        <main className="w-full p-5 font-mono">
            <NaturalLanguageInput
                onGeneratingChange={setIsGeneratingQuery}
                isLoading={isDataLoading}
            />
            <QueryBox
                onQueryExecute={onExecuteQueryWrapper}
                isDisabled={isDataLoading || isGeneratingQuery}
            />
            <QueryResult
                initialPage={currentPage === 1 ? currentPage : undefined}
                data={data}
                errorMessage={errorMessage}
                isDataLoading={isDataLoading}
                onDownload={onDownload}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
            />
        </main>
    );
};
