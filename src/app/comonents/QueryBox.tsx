import { useEffect, useState } from "react";
import { WorkspaceIcon } from "./WorkspaceIcon";
import styles from "./AIQueryBuilder/queryAgent.module.css";

type QueryBoxProps = {
  onQueryExecute: (query: string) => void;
  isDisabled?: boolean;
  initialQuery?: string;
};

export const QueryBox = ({
  onQueryExecute,
  isDisabled,
  initialQuery = "",
}: QueryBoxProps) => {
  const [query, setQuery] = useState(initialQuery);
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);
  const handleExecute = () => {
    if (!isDisabled && query.trim()) onQueryExecute(query);
  };
  return (
    <div className={styles.queryBox}>
      <textarea
        aria-label="SQL query"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={isDisabled}
        className={styles.manualInput}
        placeholder="SELECT * FROM your_table LIMIT 10;"
        spellCheck={false}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            handleExecute();
          }
        }}
      />
      <div className={styles.editorActions}>
        <span className={styles.shortcutHint}>Ctrl / ⌘ + Enter to execute</span>
        <button
          onClick={handleExecute}
          disabled={isDisabled || !query.trim()}
          className={styles.executeBtn}
        >
          <WorkspaceIcon name="play" size={14} /> Execute query
        </button>
      </div>
    </div>
  );
};
