"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAIQueryGeneration } from "@/app/hooks/useAIQueryGeneration";
import type { useDefaultDatabaseConnection } from "@/app/hooks/useDefaultDatabaseConnection";
import { QueryResult } from "../QueryResult";
import { WorkspaceIcon } from "../WorkspaceIcon";
import { QueryPrompt } from "./QueryPrompt";
import { QueryPreview } from "./QueryPreview";
import styles from "./queryAgent.module.css";

const AgentResponse = dynamic(() => import("./AgentResponse"), {
  loading: () => <p role="status">Loading query response…</p>,
});

interface NaturalLanguageInputProps {
  databaseConnection: ReturnType<typeof useDefaultDatabaseConnection>;
  onGeneratingChange?: (generating: boolean) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export default function NaturalLanguageInput({
  databaseConnection,
  onGeneratingChange,
  isLoading = false,
  placeholder = "Describe what data you need... e.g., 'Show me all active users with their recent orders'",
}: NaturalLanguageInputProps) {
  const [input, setInput] = useState("");
  const { connection, isConnecting, connectionError, retryConnection } =
    databaseConnection;
  const {
    generateQuery,
    hasStarted,
    streamedSQL,
    agentText,
    isGenerating,
    error,
    result,
  } = useAIQueryGeneration();
  const disabled =
    !connection.connected || isConnecting || isGenerating || isLoading;
  const responseText = agentText || result?.explanation;
  const reconnect = useCallback(() => retryConnection(), [retryConnection]);

  useEffect(() => {
    onGeneratingChange?.(isGenerating);
  }, [isGenerating, onGeneratingChange]);

  const handleGenerateQuery = useCallback(async () => {
    if (disabled || !input.trim()) return;
    const submitted = input;
    try {
      await generateQuery(submitted);
      // A pending response must never erase a newer draft.
      setInput((current) => (current === submitted ? "" : current));
    } catch {
      // The hook owns the user-visible error and suppresses updates after unmount.
    }
  }, [disabled, input, generateQuery]);

  return (
    <main id="query-workspace" tabIndex={-1} className={styles.queryWorkspace}>
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
        <QueryPrompt
          input={input}
          onInputChange={setInput}
          onGenerate={handleGenerateQuery}
          onRetryConnection={reconnect}
          disabled={disabled}
          isGenerating={isGenerating || isLoading}
          isConnecting={isConnecting}
          connectionError={connectionError}
          placeholder={placeholder}
        />
        {hasStarted && (
          <QueryPreview
            sql={streamedSQL}
            isGenerating={isGenerating}
            error={error}
          />
        )}
        {responseText && <AgentResponse text={responseText} />}
        {result && result.warnings.length > 0 && (
          <ul className={styles.queryWarnings} aria-label="Query warnings">
            {result.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        )}
        <section aria-label="Query results">
          <QueryResult
            result={result?.queryResult}
            isDataLoading={isGenerating}
            errorMessage={error ?? undefined}
          />
        </section>
        {isGenerating && (
          <div className={styles.generationStatus} role="status">
            <span className={styles.generationSpinner} aria-hidden="true" />
            <span>Generating response…</span>
          </div>
        )}
      </div>
    </main>
  );
}
