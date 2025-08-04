/**
 * A custom hook to handle file download functionality.
 * @param data - The 2D string array data to be downloaded as CSV
 * @returns - A function to handle file download
 */
export const useFileDownload = (data?: string[][]) => {
    const onDownload = async () => {
        const downladResponse = await fetch("/api/post/download", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        });;
        const csvData = await downladResponse.text();
        // Download the data as csv
        if (!csvData) {
            alert("No data to download.");
            return;
        }
        
        const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
        
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", "query_results.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    return { onDownload };
}