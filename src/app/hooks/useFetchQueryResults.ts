import { useState } from "react";

export const useFetchQueryResults = () => {
    const [data, setData] = useState<string[][]>();
    const [isDataLoading, setIsDataLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>();

    const executeQuery = async (query: string) => {
        setIsDataLoading(true);
        setErrorMessage(undefined);

        try {
            const response = await fetch("/api/post/query", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ query }),
            });

            if (!response.ok) {
                throw new Error("Failed to execute query");
            }

            const csvText = await response.text();
            const parsedData: string[][] = csvText.split("\n").map((row) => row.split(","));
            setData(parsedData);
        } catch (error: unknown) {
            setErrorMessage("An error occurred while fetching the query results. " + (error instanceof Error ? error.message : "Unknown error"));
        } finally {
            setIsDataLoading(false);
        }
    };

    return { data, isDataLoading, errorMessage, executeQuery };
};