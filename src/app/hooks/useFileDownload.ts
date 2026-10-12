export const useFileDownload = () => {
  const onDownload = async (query: string) => {
    try {
      const response = await fetch("/api/post/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!response.ok) throw new Error("Failed to download results.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "query_results.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to download results.",
      );
    }
  };
  return { onDownload };
};
