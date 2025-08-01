'use client'
import { useState } from "react";
import { QueryBox } from "./QueryBox";
import { QueryResult } from "./QueryResult";

/**
 * Root component of the application.
 */
export const AppEntry = () => {
    const [data, setData] = useState<string[][]>([])
    const [errorMessage, setErrorMessage] = useState<string>();

    const executeQuery = (query: string) => {
        fetch("/api/categories.csv")
            .then((response) => {
                if (!response.ok) {
                    setErrorMessage("Failed to fetch data. Please try again later.");
                }
                return response.text();
            })
            .then((csvText) => {
                // Parse CSV text into a 2D array
                const parsedData: string[][] = csvText.split("\n").map((row) => row.split(","));
                setData(parsedData);
            })
    };

    return (
        <section className="w-full p-10 font-mono">
            <QueryBox onQueryExecute={executeQuery} />
            <QueryResult data={data} errorMessage={errorMessage} />
        </section>
    );
}