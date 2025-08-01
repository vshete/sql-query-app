'use client'
import { QueryBox } from "./QueryBox";
import { QueryResult } from "./QueryResult";
import { useFetchQueryResults } from "../hooks/useFetchQueryResults";
import { useState } from "react";
import { QuerySidebar } from "./QuerySidebar";

/**
 * Root component of the application.
 */
export const AppEntry = () => {
    const { data, isDataLoading, errorMessage, executeQuery } = useFetchQueryResults();
    const [selectedQuery, setSelectedQuery] = useState<string>("");

    const predefinedQueries = [
        { name: "Get All Users", query: "SELECT * FROM users;" },
        { name: "Completed Orders", query: "SELECT * FROM orders WHERE status = 'completed';" },
        { name: "Product Count", query: "SELECT COUNT(*) FROM products;" },
    ];

    const handleQuerySelect = (query: string) => {
        setSelectedQuery(query);
    };

    return (
        <div className="flex">
            <QuerySidebar 
                queries={predefinedQueries} 
                onQuerySelect={(queryObj) => handleQuerySelect(queryObj.query)} 
            />
            <main className="flex-1 w-full p-5 font-mono">
                <QueryBox
                    onQueryExecute={executeQuery}
                    isDisabled={isDataLoading}
                    initialQuery={selectedQuery}
                />
                <QueryResult
                    data={data}
                    errorMessage={errorMessage}
                    isDataLoading={isDataLoading}
                />
            </main>
        </div>
    );
};