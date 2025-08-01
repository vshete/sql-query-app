import { useState, useEffect } from "react";

export const useFetchPredefinedQueries = () => {
    const [queries, setQueries] = useState<{ name: string; query: string }[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPredefinedQueries = async () => {
            try {
                const response = await fetch("/api/predefinedqueries");
                if (!response.ok) {
                    throw new Error(`Error fetching predefined queries: ${response.statusText}`);
                }
                const data = await response.json();
                setQueries(data);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "An unknown error occurred");
            } finally {
                setIsLoading(false);
            }
        };

        fetchPredefinedQueries();
    }, []);

    return { queries, isLoading, error };
};