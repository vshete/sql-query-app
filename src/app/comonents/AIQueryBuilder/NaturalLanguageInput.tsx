"use client";

import {
  useAIQueryGeneration,
  type QueryTurn,
} from "@/app/hooks/useAIQueryGeneration";
import type { useDefaultDatabaseConnection } from "@/app/hooks/useDefaultDatabaseConnection";
import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { QueryResult } from "../QueryResult";
import { WorkspaceIcon } from "../WorkspaceIcon";
import { QueryPreview } from "./QueryPreview";
import { QueryPrompt } from "./QueryPrompt";
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
    reset,
    request,
    previousTurns,
    hasStarted,
    streamedSQL,
    agentText,
    isGenerating,
    error,
    result,
  } = useAIQueryGeneration();

  const latestTurn = useRef<HTMLDivElement>(null);
  useEffect(() => {
    latestTurn.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [request, result]);

  const disabled =
    !connection.connected || isConnecting || isGenerating || isLoading;
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
          <p>Ask a question, then refine the answer with follow-ups.</p>
        </div>
        <span className={styles.workspaceBadge}>
          <WorkspaceIcon name="database" /> PostgreSQL
        </span>
      </div>
      <div className={styles.nlInputContainer}>
        <div className={styles.chatToolbar}>
          <span>Current session only · Follow up on any answer</span>
          <button
            type="button"
            className={styles.clearBtn}
            disabled={isGenerating || !hasStarted}
            onClick={() => {
              reset();
              setInput("");
            }}
          >
            New chat
          </button>
        </div>
        <section
          className={styles.chatHistory}
          aria-label="Conversation"
          aria-busy={isGenerating}
        >
          {previousTurns.map((turn, index) => (
            <ConversationTurn key={index} turn={turn} isGenerating={false} />
          ))}
          {hasStarted && (
            <ConversationTurn
              turn={{ request, streamedSQL, agentText, error, result }}
              isGenerating={isGenerating}
            />
          )}
          {hasStarted && <div ref={latestTurn} />}
        </section>
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

const ConversationTurn = memo(function ConversationTurn({
  turn,
  isGenerating,
}: {
  turn: QueryTurn;
  isGenerating: boolean;
}) {
  const responseText = turn.result?.explanation || turn.agentText;
  return (
    <article className={styles.chatTurn}>
      <div className={styles.userMessage}>
        <strong>You</strong>
        <p>{turn.request}</p>
      </div>
      <div className={styles.assistantMessage}>
        <strong>Query assistant</strong>
        <QueryPreview
          sql={turn.streamedSQL}
          isGenerating={isGenerating}
          error={turn.error}
        />
        {responseText && <AgentResponse text={responseText} />}
        {!!turn.result?.warnings.length && (
          <ul className={styles.queryWarnings} aria-label="Query warnings">
            {turn.result.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        )}
        <QueryResult
          result={turn.result?.queryResult}
          isDataLoading={isGenerating}
          errorMessage={turn.error ?? undefined}
        />
      </div>
    </article>
  );
});
