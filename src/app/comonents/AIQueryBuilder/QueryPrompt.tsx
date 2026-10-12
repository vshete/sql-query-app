"use client";

import { useId } from "react";
import { MAX_REQUEST_LENGTH } from "@/app/services/queryStream";
import { WorkspaceIcon } from "../WorkspaceIcon";
import styles from "./queryAgent.module.css";

interface QueryPromptProps {
  input: string;
  onInputChange: (value: string) => void;
  onGenerate: () => Promise<void>;
  onRetryConnection: () => void;
  disabled: boolean;
  isGenerating: boolean;
  isConnecting: boolean;
  connectionError: string;
  placeholder: string;
}

export function QueryPrompt({
  input,
  onInputChange,
  onGenerate,
  onRetryConnection,
  disabled,
  isGenerating,
  isConnecting,
  connectionError,
  placeholder,
}: QueryPromptProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const titleId = `${id}-title`;
  const canSubmit =
    !disabled &&
    input.trim().length > 0 &&
    input.trim().length <= MAX_REQUEST_LENGTH;

  return (
    <section
      className={styles.promptPanel}
      aria-labelledby={titleId}
      aria-busy={isGenerating}
    >
      <div className={styles.panelHeading}>
        <span className={styles.aiIcon}>
          <WorkspaceIcon name="sparkles" size={20} />
        </span>
        <div>
          <label id={titleId} htmlFor={id} className={styles.label}>
            Ask your database
          </label>
          <p id={descriptionId} className={styles.panelDescription}>
            Ask a question or follow up on an earlier answer.
          </p>
        </div>
        <span className={styles.aiBadge}>AI ASSIST</span>
      </div>
      <textarea
        id={id}
        className={styles.textarea}
        value={input}
        onChange={(event) => onInputChange(event.target.value)}
        aria-describedby={descriptionId}
        placeholder={placeholder}
        rows={3}
        maxLength={MAX_REQUEST_LENGTH}
        disabled={disabled}
        onKeyDown={(event) => {
          if (
            !event.nativeEvent.isComposing &&
            (event.metaKey || event.ctrlKey) &&
            event.key === "Enter"
          ) {
            event.preventDefault();
            if (canSubmit) void onGenerate();
          }
        }}
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
            onClick={onRetryConnection}
            disabled={isConnecting}
          >
            Retry connection
          </button>
        </div>
      )}
      <div className={styles.promptActions}>
        <span className={styles.shortcutHint}>Ctrl / ⌘ + Enter to send</span>
        <button
          type="button"
          className={styles.generateBtn}
          onClick={() => void onGenerate()}
          disabled={!canSubmit}
        >
          <WorkspaceIcon name="sparkles" />
          {isGenerating ? "Generating…" : "Send message"}
        </button>
        {input && (
          <button
            className={styles.clearBtn}
            onClick={() => onInputChange("")}
            type="button"
            disabled={isGenerating}
          >
            Clear
          </button>
        )}
      </div>
    </section>
  );
}
