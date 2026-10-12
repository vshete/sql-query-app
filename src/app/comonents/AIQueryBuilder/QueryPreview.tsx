"use client";

import dynamic from "next/dynamic";
import { memo } from "react";
import { WorkspaceIcon } from "../WorkspaceIcon";
import styles from "./queryAgent.module.css";

const CodeEditor = dynamic(
  () => import("../editor/CodeEditor").then((module) => module.CodeEditor),
  {
    loading: () => (
      <p className={styles.panelDescription} role="status">
        Loading SQL preview…
      </p>
    ),
  },
);

export const QueryPreview = memo(function QueryPreview({
  sql,
  isGenerating,
  error,
}: {
  sql: string;
  isGenerating: boolean;
  error: string | null;
}) {
  return (
    <section className={styles.sqlPreview} aria-label="SQL generation preview">
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
        <CodeEditor code={sql} />
      </div>
    </section>
  );
});
