'use client'
import { useState } from "react";
import { QueryBox } from "./QueryBox";
import { QueryResult } from "./QueryResult";
import { useFetchQueryResults } from "../hooks/useFetchQueryResults";

/**
 * Root component of the application.
 */
export const AppEntry = () => {
    const { data, isDataLoading, errorMessage, executeQuery } = useFetchQueryResults();

    return (
        <section className="w-full p-5 font-mono">
            <QueryBox onQueryExecute={executeQuery} isDisabled={isDataLoading} />
            <QueryResult data={data} errorMessage={errorMessage} isDataLoading={isDataLoading} />
        </section>
    );
}