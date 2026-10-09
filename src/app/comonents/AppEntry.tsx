'use client'
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
    const { data, isDataLoading, errorMessage, totalPages } = useFetchQueryResults(currentPage);
    const { onDownload } = useFileDownload();

    return (
        <main className="w-full p-5 font-mono">
            <NaturalLanguageInput
                isLoading={isDataLoading}
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
