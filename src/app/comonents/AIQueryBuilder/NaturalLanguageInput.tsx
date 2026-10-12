"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useAIQueryGeneration } from "@/app/hooks/useAIQueryGeneration";
import styles from "./queryAgent.module.css";
import { CodeEditor } from "../editor/CodeEditor";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useDefaultDatabaseConnection } from "@/app/hooks/useDefaultDatabaseConnection";
import type { DatabaseQueryResult } from "@/app/types/query.types";
import { QueryResult } from "../QueryResult";
import SchemaExplorer from "./SchemaExplorer";
import { WorkspaceIcon } from "../WorkspaceIcon";

interface Props {
  onGeneratingChange?: (generating: boolean) => void;
  isLoading?: boolean;
  placeholder?: string;
}

const NaturalLanguageInput: React.FC<Props> = ({
  onGeneratingChange,
  isLoading = false,
  placeholder = "Describe what data you need... e.g., 'Show me all active users with their recent orders'",
}) => {
  const [input, setInput] = useState("");
  const { connection, isConnecting, connectionError, retryConnection } =
    useDefaultDatabaseConnection();
  const [result, setResult] = useState<DatabaseQueryResult>();
  const {
    generateQuery,
    hasStarted,
    streamedSQL,
    agentText,
    isGenerating,
    error,
  } = useAIQueryGeneration();
  useEffect(() => {
    onGeneratingChange?.(isGenerating);
  }, [isGenerating, onGeneratingChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
  };

  const handleGenerateQuery = useCallback(async () => {
    if (
      !input.trim() ||
      !connection.connected ||
      isConnecting ||
      isGenerating ||
      isLoading
    )
      return;

    try {
      setResult(undefined);
      const response = await generateQuery(input);
      setResult(response.queryResult);
      setInput("");
    } catch (err) {
      console.error("Error generating query:", err);
    }
  }, [
    input,
    generateQuery,
    connection.connected,
    isConnecting,
    isGenerating,
    isLoading,
  ]);

  const resultData = useMemo(
    () =>
      result
        ? [
            result.columns,
            ...result.rows.map((row) =>
              result.columns.map((column) => String(row[column] ?? "")),
            ),
          ]
        : undefined,
    [result],
  );

  const downloadResults = () => {
    if (!resultData) return;
    const csv = resultData
      .map((row) =>
        row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "query_results.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.workspaceLayout}>
      <SchemaExplorer
        key={connection.label ?? "disconnected"}
        connection={connection}
        isLoading={isConnecting}
      />
      <div className={styles.queryWorkspace}>
        <div className={styles.workspaceHeading}>
          <div>
            <p className={styles.eyebrow}>YOUR DATA, A LITTLE CLOSER</p>
            <h1>Query workspace</h1>
            <p>
              Ask a question. Explore the SQL. Get answers from your database.
            </p>
          </div>
          <span className={styles.workspaceBadge}>
            <WorkspaceIcon name="database" /> PostgreSQL
          </span>
        </div>
        <div className={styles.nlInputContainer}>
          <section
            className={styles.promptPanel}
            aria-labelledby="prompt-title"
          >
            <div className={styles.panelHeading}>
              <span className={styles.aiIcon}>
                <WorkspaceIcon name="sparkles" size={20} />
              </span>
              <div>
                <label
                  id="prompt-title"
                  htmlFor="natural-language-query"
                  className={styles.label}
                >
                  What data do you need?
                </label>
                <p className={styles.panelDescription}>
                  Ask in plain English to generate and run a SQL query.
                </p>
              </div>
              <span className={styles.aiBadge}>AI ASSIST</span>
            </div>
            <textarea
              id="natural-language-query"
              className={styles.textarea}
              value={input}
              onChange={handleInputChange}
              placeholder={placeholder}
              rows={3}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void handleGenerateQuery();
                }
              }}
              disabled={
                !connection.connected ||
                isConnecting ||
                isGenerating ||
                isLoading
              }
            />

            {isConnecting && (
              <p className={styles.panelDescription} role="status">
                Connecting to your database…
              </p>
            )}
            {connectionError && (
              <div className={styles.error} role="alert">
                <p>{connectionError}</p>
                <button
                  type="button"
                  className={styles.clearBtn}
                  onClick={retryConnection}
                >
                  Retry connection
                </button>
              </div>
            )}
            {error && (
              <div className={styles.error} role="alert">
                <span>Error: {error}</span>
              </div>
            )}

            <div className={styles.promptActions}>
              <span className={styles.shortcutHint}>
                Ctrl / ⌘ + Enter to generate
              </span>
              <button
                className={styles.generateBtn}
                onClick={handleGenerateQuery}
                disabled={
                  !connection.connected ||
                  isConnecting ||
                  !input.trim() ||
                  isGenerating ||
                  isLoading
                }
              >
                <WorkspaceIcon name="sparkles" />
                {isGenerating || isLoading
                  ? "Generating…"
                  : "Generate & run SQL"}
              </button>

              {input.trim() && (
                <button
                  className={styles.clearBtn}
                  onClick={() => setInput("")}
                  type="button"
                >
                  Clear
                </button>
              )}
            </div>
          </section>

          {hasStarted && (
            <section
              className={styles.mockResults}
              aria-label="SQL generation preview"
            >
              <div className={styles.editorHeading}>
                <WorkspaceIcon name="sparkles" />
                <strong>
                  {isGenerating
                    ? "Generating SQL…"
                    : error
                      ? "Incomplete SQL"
                      : "Generated SQL"}
                </strong>
                <span className={styles.editorMeta}>READ-ONLY PREVIEW</span>
              </div>
              <div className={styles.sqlEditor}>
                <CodeEditor code={streamedSQL} language="sql" />
              </div>
            </section>
          )}

          {agentText && (
            <section
              className={styles.responsePanel}
              aria-label="Agent response"
            >
              <div className={styles.editorHeading}>
                <WorkspaceIcon name="sparkles" />
                <strong>Query response</strong>
              </div>
              <div className={styles.markdown}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {agentText}
                </ReactMarkdown>
              </div>
            </section>
          )}

          <section aria-label="Query results">
            <QueryResult
              data={resultData}
              isDataLoading={isGenerating}
              message={result?.message}
              onDownload={downloadResults}
              totalPages={Math.max(1, Math.ceil((result?.rowCount ?? 0) / 10))}
            />
          </section>

          {isGenerating && (
            <div
              className={styles.generationStatus}
              role="status"
              aria-live="polite"
            >
              <span className={styles.generationSpinner} aria-hidden="true" />
              <span>Generating response…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NaturalLanguageInput;
