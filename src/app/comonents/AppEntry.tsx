'use client'
import { useEffect, useState } from "react";
import { QueryBox } from "./QueryBox";
import { QueryResult } from "./QueryResult";

/**
 * Root component of the application.
 */
export const AppEntry = () => {
    const [data, setData] = useState<string[][]>([])

    useEffect(() => {
        fetch("/api/categories.csv")
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Network response was not ok");
                }
                return response.text();
            })
            .then((csvText) => {
                // Parse CSV text into a 2D array
                const parsedData: string[][] = csvText.split("\n").map((row) => row.split(","));
                setData(parsedData);
            })
    }, []);

    return (
        <section>
            <QueryBox />
            <QueryResult data={data} />
        </section>

    );
}