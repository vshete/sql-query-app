import { useCallback, useEffect, useRef, useState } from "react";

export const useFetchQueryResults = (currentPage: number) => {
    const [data, setData] = useState<string[][]>();
    const [pagesFetched, setPagesFetched] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [isDataLoading, setIsDataLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>();
    const storedQuery = useRef("");
    const loading = useRef(false);

    const executeQuery = useCallback(async (query: string, page = 1) => {
        if (loading.current) return;
        loading.current = true;
        setIsDataLoading(true);
        setErrorMessage(undefined);
        if (page === 1) {
            setData(undefined);
            setPagesFetched(0);
            setTotalPages(0);
            storedQuery.current = query;
        }
        try {
            const response = await fetch("/api/post/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, page }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Failed to execute query");
            const parsedData: string[][] = result.csv.split("\n").map((row: string) => row.split(","));
            setData((previous) => page === 1 ? parsedData : [...(previous ?? []), ...parsedData]);
            setPagesFetched(result.currentPage);
            setTotalPages(result.totalPages);
        } catch (error: unknown) {
            setErrorMessage("An error occurred while fetching the query results. " + (error instanceof Error ? error.message : "Unknown error"));
        } finally {
            loading.current = false;
            setIsDataLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isDataLoading && !errorMessage && pagesFetched > 0 && currentPage > pagesFetched && pagesFetched < totalPages) {
            void executeQuery(storedQuery.current, pagesFetched + 1);
        }
    }, [currentPage, pagesFetched, executeQuery, totalPages, isDataLoading, errorMessage]);

    return { data, isDataLoading, errorMessage, executeQuery, totalPages };
};
