import { useCallback, useEffect, useState } from "react";

export const useFetchQueryResults = (currentPage: number) => {
    const [data, setData] = useState<string[][]>();
    const [pagesFetched, setPagesFetched] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [isDataLoading, setIsDataLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>();

    const executeQuery = useCallback(async (query: string, page = 1) => {
        setIsDataLoading(true);
        setErrorMessage(undefined);
        if(!page || page === 1) {
            setData(undefined);
            setPagesFetched(0);
            setTotalPages(0);
        }

        try {
            const response = await fetch("/api/post/query", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ query, page }),
            });

            if (!response.ok) {
                throw new Error("Failed to execute query");
            }

            const {csv, currentPage: latestPageFetched, totalPages: totalPagesFromResponse } = await response.json();
            
            if (!csv) {
                throw new Error("No data returned from the query");
            }

            if(latestPageFetched > pagesFetched) {
                setPagesFetched(latestPageFetched);
            }
            
            setTotalPages(totalPagesFromResponse);
        
            const parsedData: string[][] = csv.split("\n").map((row: string) => row.split(","));
            
            if(data) {
                setData([...data, ...parsedData]);
            } else {
                setData(parsedData);
            }
            
        } catch (error: unknown) {
            setErrorMessage("An error occurred while fetching the query results. " + (error instanceof Error ? error.message : "Unknown error"));
        } finally {
            setIsDataLoading(false);
        }
    }, [data, pagesFetched, totalPages]);

    useEffect(() => {
        if (pagesFetched > 0 && currentPage >= pagesFetched && pagesFetched < totalPages) {
            executeQuery("QUERY_DOES_NOT_MATTER_RIGHT_NOW", pagesFetched + 1);
        }
    }, [currentPage, pagesFetched]);

    return { data, isDataLoading, errorMessage, executeQuery, totalPages};
};