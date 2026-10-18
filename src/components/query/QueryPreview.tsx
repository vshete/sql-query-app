"use client";

import dynamic from "next/dynamic";
import { memo, useMemo } from "react";
import { format } from "sql-formatter";
import { WorkspaceIcon } from "./WorkspaceIcon";
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

/** Format completed SQL for display only; preserve partial or unsupported SQL verbatim. */
export const QueryPreview = memo(function QueryPreview({
  sql,
  isGenerating,
  error,
}: {
  sql: string;
  isGenerating: boolean;
  error: string | null;
}) {
  const displaySql = useMemo(() => {
    if (!sql || isGenerating || error) return sql;
    try {
      return format(sql, { language: "postgresql", tabWidth: 2 });
    } catch {
      // Keep the preview available for syntax the formatter cannot handle.
      return sql;
    }
  }, [sql, isGenerating, error]);

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
        <CodeEditor code={displaySql} />
      </div>
    </section>
  );
});
